#!/usr/bin/env python3
"""Zpětná vazba ze Segmentovky: přijme hlášení z webu a založí z něj issue v Gitea.

Na server běží za nginx (POST /api/zpetna-vazba → 127.0.0.1:24790). Databáze žádná:
hlášení jsou issues v soukromém repozitáři autor/segmentovka, zakládá je uživatel
segmentovka-bot (typ bot – Gitea mu nic neposílá, majiteli repozitáře přijde e-mail).
Token (scope write:issue) čte ze souboru od systemd (LoadCredential), v prostředí ani
v logu není. Jen standardní knihovna Pythonu.

    server.py serve --repo autor/segmentovka --origin https://segmentovka.miloslavbrada.cz
    server.py serve --dry-run --static ../dist --port 8000   # lokálně: web i API, issue jen do logu
"""
import argparse
import hashlib
import json
import os
import re
import sys
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
from collections import deque
from datetime import datetime
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from zoneinfo import ZoneInfo

PATH = '/api/zpetna-vazba'
# typ hlášení: (název do titulku, štítek, barva štítku)
KINDS = {
    'chyba': ('Chyba', 'chyba', '#d93b1b'),
    'napad': ('Nápad', 'nápad', '#2f8f4e'),
    'dotaz': ('Dotaz', 'dotaz', '#1d6fd6'),
    'jine': ('Zpětná vazba', None, None),
}
BASE_LABEL = ('zpětná vazba', '#8a8f8c', 'Hlášení z formuláře na segmentovka.miloslavbrada.cz')
MAX_BODY = 64 * 1024
MAX_MESSAGE = 5000
MAX_PARAMS = 24 * 1024
MAX_CHANGED = 200
MIN_FILL_MS = 2000          # rychlejší odeslání od otevření formuláře dělají jen roboti
MAX_LINKS = 3               # spam skoro vždy nese odkazy; skutečné hlášení jich má nanejvýš pár
LINK_RE = re.compile(r'https?://|www\.|\[url', re.I)
DUPLICATE_WINDOW = 3600     # stejná zpráva znovu do hodiny issue nezaloží (dvojklik, opakovaný robot)
EMAIL_RE = re.compile(r'^[^@\s<>()\[\]`\\,;:"]+@[^@\s<>()\[\]`\\,;:"]+\.[^@\s<>()\[\]`\\,;:"]+$')
CONTROL_RE = re.compile(r'[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]')
TZ = ZoneInfo('Europe/Prague')


class Rejected(Exception):
    """Hlášení nejde přijmout; zpráva je pro návštěvníka."""
    def __init__(self, status, message):
        super().__init__(message)
        self.status = status


# ---------- kontrola vstupu ----------

def text(v, limit, multiline=False):
    if v is None:
        return ''
    if not isinstance(v, str):
        raise Rejected(400, 'Neplatná data formuláře.')
    v = CONTROL_RE.sub('', v.replace('\r\n', '\n').replace('\r', '\n'))
    if not multiline:
        v = ' '.join(v.split())
    return v.strip()[:limit]


def parse(data):
    """Z JSONu formuláře udělá ověřené hlášení, nebo vyhodí Rejected."""
    if not isinstance(data, dict):
        raise Rejected(400, 'Neplatná data formuláře.')
    kind = data.get('kind')
    if kind not in KINDS:
        raise Rejected(400, 'Vyberte, o co jde.')
    message = text(data.get('message'), MAX_MESSAGE + 1, multiline=True)
    if len(message) < 3:
        raise Rejected(400, 'Napište prosím zprávu.')
    if len(message) > MAX_MESSAGE:
        raise Rejected(400, f'Zpráva je delší než {MAX_MESSAGE} znaků.')
    if len(LINK_RE.findall(message)) > MAX_LINKS:
        raise Rejected(400, f'Zpráva obsahuje víc než {MAX_LINKS} odkazy. Nechte prosím jen ty nejdůležitější.')
    email = text(data.get('email'), 201)
    if email and (len(email) > 200 or not EMAIL_RE.match(email)):
        raise Rejected(400, 'E-mail nevypadá správně. Opravte ho, nebo pole nechte prázdné.')
    params = data.get('params')
    if params is not None:
        if not isinstance(params, dict) or len(json.dumps(params, ensure_ascii=False)) > MAX_PARAMS:
            params = None
    changed = []
    raw = data.get('changed')
    if params is not None and isinstance(raw, list):
        for item in raw[:MAX_CHANGED]:
            if isinstance(item, list) and len(item) == 3 and isinstance(item[0], str):
                changed.append((text(item[0], 40), item[1], item[2]))
    ctx = data.get('context') if isinstance(data.get('context'), dict) else {}
    return {
        'kind': kind,
        'message': message,
        'email': email,
        'params': params,
        'changed': changed,
        'lang': text(ctx.get('lang'), 40),
        'viewport': text(ctx.get('viewport'), 40),
        'screen': text(ctx.get('screen'), 60),
        'view': text(ctx.get('view'), 60),
        'warnings': text(ctx.get('warnings'), 2000, multiline=True),
        'status': text(ctx.get('status'), 500),
    }


# ---------- issue v Markdownu ----------

def code(v):
    """Inline kód, který vydrží i zpětné apostrofy a svislítka uvnitř hodnoty."""
    s = v if isinstance(v, str) else json.dumps(v, ensure_ascii=False)
    s = ' '.join(s.split()).replace('|', '\\|')
    if not s:
        return '_prázdné_'
    run = max((len(m) for m in re.findall(r'`+', s)), default=0)
    tick = '`' * (run + 1)
    pad = ' ' if run or s.startswith('`') or s.endswith('`') else ''
    return f'{tick}{pad}{s}{pad}{tick}'


def cell(v):
    return ' '.join(str(v).split()).replace('|', '\\|') or '–'


def quote(s):
    return '\n'.join('> ' + line if line.strip() else '>' for line in s.split('\n'))


def fence(s, lang=''):
    run = max((len(m) for m in re.findall(r'`{3,}', s)), default=2)
    tick = '`' * (run + 1)
    return f'{tick}{lang}\n{s}\n{tick}'


def title_of(r):
    first = ' '.join(r['message'].split('\n', 1)[0].split())
    if len(first) > 72:
        first = first[:71].rstrip() + '…'
    return f"{KINDS[r['kind']][0]}: {first}"


def body_of(r, user_agent, now=None):
    now = now or datetime.now(TZ)
    kind = KINDS[r['kind']][0]
    out = [f"**{kind}** z formuláře na segmentovka.miloslavbrada.cz · {now.day}. {now.month}. {now.year} {now:%H:%M}", '',
           quote(r['message']), '']
    if r['email']:
        subject = urllib.parse.quote(f'Re: {title_of(r)}')
        to = urllib.parse.quote(r['email'], safe='@+')
        out.append(f"**Kontakt:** {r['email']} – [odpovědět e-mailem](mailto:{to}?subject={subject})")
    else:
        out.append('**Kontakt:** _bez e-mailu, odpovědět nejde_')
    if r['params'] is not None:
        p = r['params']
        out += ['', '### Nastavení generátoru', '']
        line = f"Rozložení {code(p.get('layout', '?'))}"
        changed = [c for c in r['changed'] if c[0] != 'layout']
        if changed:
            out += [line + f' · změněné parametry ({len(changed)}):', '',
                    '| parametr | hodnota | výchozí |', '|---|---|---|']
            out += [f'| {code(k)} | {code(v)} | {code(d)} |' for k, v, d in changed]
        else:
            out.append(line + ', ostatní parametry výchozí.')
        out += ['', '<details><summary>Všechny parametry – uložit jako .json a načíst v generátoru tlačítkem Načíst parametry…</summary>', '',
                fence(json.dumps(p, ensure_ascii=False, indent=2), 'json'), '', '</details>']
    else:
        out += ['', '_Nastavení generátoru nepřiloženo._']
    if r['warnings'] or r['status']:
        out += ['', '### Na stránce bylo vidět', '']
        if r['status']:
            out.append(f"Stav: {code(r['status'])}")
        if r['warnings']:
            out += ['', 'Upozornění generátoru:', '', quote(r['warnings'])]
    out += ['', '### Prohlížeč', '', '| | |', '|---|---|',
            f'| prohlížeč | {cell(user_agent)} |',
            f"| jazyk | {cell(r['lang'])} |",
            f"| okno | {cell(r['viewport'])} (obrazovka {cell(r['screen'])}) |"]
    if r['view']:
        out.append(f"| pohled | {cell(r['view'])} |")
    return '\n'.join(out) + '\n'


# ---------- Gitea ----------

class Gitea:
    def __init__(self, url, repo, token, timeout=15):
        self.base = f"{url.rstrip('/')}/api/v1/repos/{repo}"
        self.token = token
        self.timeout = timeout
        self.labels = {}
        self.lock = threading.Lock()

    def call(self, method, path, body=None):
        req = urllib.request.Request(
            self.base + path, method=method,
            data=None if body is None else json.dumps(body).encode(),
            headers={'Authorization': f'token {self.token}', 'Accept': 'application/json',
                     'Content-Type': 'application/json', 'User-Agent': 'segmentovka-zpetna-vazba'})
        with urllib.request.urlopen(req, timeout=self.timeout) as resp:
            return json.load(resp)

    def label_ids(self, wanted):
        """Id štítků podle názvu; chybějící založí (název, barva, popis)."""
        with self.lock:
            if any(name not in self.labels for name, _, _ in wanted):
                page = 1
                while True:
                    rows = self.call('GET', f'/labels?page={page}&limit=50')
                    self.labels.update({row['name']: row['id'] for row in rows})
                    if len(rows) < 50:
                        break
                    page += 1
            for name, color, desc in wanted:
                if name not in self.labels:
                    row = self.call('POST', '/labels', {'name': name, 'color': color, 'description': desc})
                    self.labels[name] = row['id']
            return [self.labels[name] for name, _, _ in wanted]

    def create_issue(self, title, body, labels):
        try:
            ids = self.label_ids(labels)
        except (urllib.error.URLError, OSError, ValueError, KeyError) as e:
            log(f'štítky nejdou: {e}; issue bude bez nich')
            ids = []
        return self.call('POST', '/issues', {'title': title, 'body': body, 'labels': ids})['number']


class DryRun:
    """Místo Gitea jen vypíše issue do logu (lokální vývoj)."""
    def __init__(self):
        self.n = 0

    def create_issue(self, title, body, labels):
        self.n += 1
        log(f'--- issue #{self.n} [{", ".join(name for name, _, _ in labels)}] {title}\n{body}---')
        return self.n


# ---------- omezení četnosti ----------

class Limiter:
    def __init__(self, per_ip=5, window=600, per_day=50):
        self.per_ip, self.window, self.per_day = per_ip, window, per_day
        self.ips = {}
        self.day = deque()
        self.lock = threading.Lock()

    def allow(self, ip, now=None):
        now = time.monotonic() if now is None else now
        with self.lock:
            while self.day and now - self.day[0] > 86400:
                self.day.popleft()
            if len(self.ips) > 1000:
                self.ips = {k: q for k, q in self.ips.items() if q and now - q[-1] <= self.window}
            q = self.ips.setdefault(ip, deque())
            while q and now - q[0] > self.window:
                q.popleft()
            if len(q) >= self.per_ip or len(self.day) >= self.per_day:
                return False
            q.append(now)
            self.day.append(now)
            return True


class Recent:
    """Otisky nedávno přijatých zpráv – stejná zpráva podruhé issue nezaloží."""
    def __init__(self, window=DUPLICATE_WINDOW):
        self.window = window
        self.seen = {}
        self.lock = threading.Lock()

    @staticmethod
    def key(report):
        raw = '\n'.join((report['kind'], ' '.join(report['message'].lower().split()), report['email'].lower()))
        return hashlib.sha256(raw.encode()).hexdigest()

    def __contains__(self, key):
        now = time.monotonic()
        with self.lock:
            self.seen = {k: t for k, t in self.seen.items() if now - t <= self.window}
            return key in self.seen

    def add(self, key):
        with self.lock:
            self.seen[key] = time.monotonic()


# ---------- HTTP ----------

def log(msg):
    print(msg, file=sys.stderr, flush=True)


class Handler(SimpleHTTPRequestHandler):
    server_version = 'zpetna-vazba'
    sys_version = ''

    def __init__(self, *args, app, **kwargs):
        self.app = app
        super().__init__(*args, directory=app['static'] or os.devnull, **kwargs)

    def log_message(self, fmt, *args):
        if self.app['static']:
            super().log_message(fmt, *args)

    def reply(self, status, obj):
        data = json.dumps(obj, ensure_ascii=False).encode()
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(data)))
        self.send_header('Cache-Control', 'no-store')
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):
        if self.app['static'] and not self.path.startswith('/api/'):
            return super().do_GET()
        self.reply(405 if self.path.split('?')[0] == PATH else 404, {'error': 'Nenalezeno.'})

    def do_HEAD(self):
        if self.app['static']:
            return super().do_HEAD()
        self.send_error(404)

    def do_POST(self):
        if self.path.split('?')[0] != PATH:
            return self.reply(404, {'error': 'Nenalezeno.'})
        try:
            number = self.accept()
        except Rejected as e:
            if e.status != 200:
                log(f'odmítnuto ({e.status}): {e}')
            return self.reply(e.status, {'ok': True} if e.status == 200 else {'error': str(e)})
        self.reply(201, {'ok': True, 'number': number})

    def accept(self):
        origin = self.headers.get('Origin')
        if self.app['origins'] and origin and origin not in self.app['origins']:
            raise Rejected(403, 'Odesílat jde jen z webu Segmentovky.')
        if 'application/json' not in (self.headers.get('Content-Type') or ''):
            raise Rejected(415, 'Neplatná data formuláře.')
        try:
            size = int(self.headers.get('Content-Length') or '')
        except ValueError:
            raise Rejected(411, 'Neplatná data formuláře.') from None
        if size > MAX_BODY:
            raise Rejected(413, 'Zpráva je příliš dlouhá.')
        try:
            data = json.loads(self.rfile.read(size).decode('utf-8'))
        except (UnicodeDecodeError, ValueError):
            raise Rejected(400, 'Neplatná data formuláře.') from None
        if isinstance(data, dict) and data.get('website'):
            raise Rejected(200, 'honeypot')        # robot vyplnil skryté pole: tváříme se, že prošlo
        report = parse(data)
        elapsed = data.get('elapsed')
        if not isinstance(elapsed, (int, float)) or elapsed < MIN_FILL_MS:
            raise Rejected(400, 'Odesláno příliš rychle. Počkejte chvilku a zkuste to znovu.')
        fingerprint = Recent.key(report)
        if fingerprint in self.app['recent']:
            log('duplicitní zpráva, issue se nezakládá')
            raise Rejected(200, 'duplicate')
        ip = self.client_address[0]
        if ip in ('127.0.0.1', '::1'):
            ip = self.headers.get('X-Real-IP') or ip
        if not self.app['limiter'].allow(ip):
            raise Rejected(429, 'Odeslali jste hodně zpráv za sebou. Zkuste to prosím později.')
        kind = KINDS[report['kind']]
        labels = [BASE_LABEL] + ([(kind[1], kind[2], '')] if kind[1] else [])
        try:
            number = self.app['gitea'].create_issue(title_of(report), body_of(report, self.headers.get('User-Agent', '')), labels)
        except (urllib.error.URLError, OSError, ValueError, KeyError) as e:
            log(f'Gitea selhala: {e}')
            raise Rejected(502, 'Zprávu se teď nepodařilo uložit. Zkuste to prosím za chvíli znovu.') from None
        self.app['recent'].add(fingerprint)
        log(f"issue #{number} ({report['kind']}{', s e-mailem' if report['email'] else ''})")
        return number


def make_server(host, port, gitea, origins=(), static=None, limiter=None):
    app = {'gitea': gitea, 'origins': set(origins), 'static': static, 'limiter': limiter or Limiter(),
           'recent': Recent()}
    return ThreadingHTTPServer((host, port), partial(Handler, app=app))


def main(argv=None):
    ap = argparse.ArgumentParser(description='Zpětná vazba ze Segmentovky do issues v Gitea')
    sub = ap.add_subparsers(dest='cmd', required=True)
    s = sub.add_parser('serve')
    s.add_argument('--host', default='127.0.0.1')
    s.add_argument('--port', type=int, default=24790)
    s.add_argument('--gitea', default='http://127.0.0.1:3000')
    s.add_argument('--repo', default='autor/segmentovka')
    s.add_argument('--token-file', help='výchozí $CREDENTIALS_DIRECTORY/gitea-token (systemd LoadCredential)')
    s.add_argument('--origin', action='append', default=[], help='povolený Origin (lze opakovat); bez něj se nekontroluje')
    s.add_argument('--static', help='adresář webu, který služba také obslouží (lokální vývoj)')
    s.add_argument('--dry-run', action='store_true', help='issue jen vypsat do logu, Gitea nevolat')
    a = ap.parse_args(argv)
    if a.dry_run:
        gitea = DryRun()
    else:
        path = a.token_file or os.path.join(os.environ.get('CREDENTIALS_DIRECTORY', ''), 'gitea-token')
        try:
            token = open(path, encoding='utf-8').read().strip()
        except OSError as e:
            sys.exit(f'token do Gitea nejde načíst: {e}')
        if not token:
            sys.exit(f'prázdný token v {path}')
        gitea = Gitea(a.gitea, a.repo, token)
    srv = make_server(a.host, a.port, gitea, a.origin, os.path.abspath(a.static) if a.static else None)
    log(f"zpětná vazba poslouchá na {a.host}:{a.port}{PATH} → {'dry-run' if a.dry_run else a.repo}")
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == '__main__':
    main()
