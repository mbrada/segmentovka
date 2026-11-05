#!/usr/bin/env python3
# SPDX-License-Identifier: AGPL-3.0-or-later
# Copyright (C) 2026 Miloslav Brada
"""Testy služby zpětné vazby proti falešné Gitea: python3 zpetna-vazba/test_server.py"""
import itertools
import json
import os
import sys
import threading
import unittest
import urllib.error
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import server  # noqa: E402


class FakeGitea(BaseHTTPRequestHandler):
    """Repozitář se štítky a issues v paměti; zaznamená každý požadavek."""
    calls = []
    hosts = []
    labels = []
    fail = False

    def log_message(self, *a):
        pass

    def send(self, status, obj):
        data = json.dumps(obj).encode()
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):
        FakeGitea.calls.append(('GET', self.path, None, self.headers.get('Authorization')))
        self.send(200, FakeGitea.labels if '/labels' in self.path else [])

    def do_POST(self):
        body = json.loads(self.rfile.read(int(self.headers['Content-Length'])))
        FakeGitea.calls.append(('POST', self.path, body, self.headers.get('Authorization')))
        FakeGitea.hosts.append((self.headers.get('Host'), self.headers.get('X-Forwarded-Proto')))
        if FakeGitea.fail:
            return self.send(500, {'message': 'chyba'})
        if self.path.endswith('/labels'):
            row = {'id': 100 + len(FakeGitea.labels), 'name': body['name']}
            FakeGitea.labels.append(row)
            return self.send(201, row)
        self.send(201, {'number': 7})


def post(url, payload, headers=None):
    data = json.dumps(payload).encode() if not isinstance(payload, bytes) else payload
    req = urllib.request.Request(url, data=data, method='POST',
                                 headers={'Content-Type': 'application/json', **(headers or {})})
    try:
        with urllib.request.urlopen(req, timeout=5) as r:
            return r.status, json.load(r)
    except urllib.error.HTTPError as e:
        return e.code, json.load(e)


SERIAL = itertools.count(1)


def report(**kw):
    """Hlášení z formuláře; každé má jiný text, aby ho služba nebrala jako duplicitní."""
    base = {'kind': 'chyba', 'message': f'Při rozložení 88:88 chybí\nsloupek vpravo. ({next(SERIAL)})', 'email': '',
            'elapsed': 5000, 'website': '', 'context': {'lang': 'cs-CZ', 'viewport': '1280×800'}}
    base.update(kw)
    return base


class Base(unittest.TestCase):
    def setUp(self):
        FakeGitea.calls, FakeGitea.hosts, FakeGitea.fail = [], [], False
        FakeGitea.labels = [{'id': 1, 'name': 'zpětná vazba'}]
        self.fake = ThreadingHTTPServer(('127.0.0.1', 0), FakeGitea)
        threading.Thread(target=self.fake.serve_forever, daemon=True).start()
        gitea = server.Gitea(f'http://127.0.0.1:{self.fake.server_port}', 'autor/segmentovka', 'tajny-token',
                             public_url='https://gitea.example.cz')
        self.srv = server.make_server('127.0.0.1', 0, gitea, origins=['https://segmentovka.miloslavbrada.cz'],
                                      limiter=server.Limiter(per_ip=3, per_day=10))
        threading.Thread(target=self.srv.serve_forever, daemon=True).start()
        self.url = f'http://127.0.0.1:{self.srv.server_port}{server.PATH}'
        self._stderr, sys.stderr = sys.stderr, open(os.devnull, 'w')

    def tearDown(self):
        sys.stderr.close()
        sys.stderr = self._stderr
        self.srv.shutdown()
        self.fake.shutdown()
        self.srv.server_close()
        self.fake.server_close()

    def issues(self):
        return [c for c in FakeGitea.calls if c[0] == 'POST' and c[1].endswith('/issues')]


class TestService(Base):
    def test_creates_issue_with_labels(self):
        st, res = post(self.url, report(email='jan@example.com', params={'layout': '88:88', 'digitH': 60},
                                        changed=[['digitH', 60, 40]]),
                       {'Origin': 'https://segmentovka.miloslavbrada.cz', 'User-Agent': 'Testovaci | prohlizec'})
        self.assertEqual((st, res), (201, {'ok': True, 'number': 7}))
        [(_, path, body, auth)] = self.issues()
        self.assertEqual(path, '/api/v1/repos/autor/segmentovka/issues')
        self.assertEqual(auth, 'token tajny-token')
        # odkazy v e-mailech od Gitea mají vést na veřejnou adresu, ne na 127.0.0.1
        self.assertEqual(set(FakeGitea.hosts), {('gitea.example.cz', 'https')})
        self.assertEqual(body['title'], 'Chyba: Při rozložení 88:88 chybí')   # jen první řádek
        self.assertEqual(body['labels'], [1, 101])            # „zpětná vazba“ existoval, „chyba“ přibyl
        self.assertIn({'id': 101, 'name': 'chyba'}, FakeGitea.labels)
        md = body['body']
        self.assertIn('> Při rozložení 88:88 chybí\n> sloupek vpravo.', md)
        self.assertIn('mailto:jan@example.com?subject=Re%3A%20Chyba', md)
        self.assertIn('| `digitH` | `60` | `40` |', md)
        self.assertIn('"digitH": 60', md)
        self.assertIn('Testovaci \\| prohlizec', md)

    def test_labels_cached(self):
        post(self.url, report())
        post(self.url, report())
        self.assertEqual(len([c for c in FakeGitea.calls if '/labels' in c[1]]), 2)   # jeden GET a jeden POST

    def test_other_kind_without_kind_label(self):
        post(self.url, report(kind='jine'))
        [(_, _, body, _)] = self.issues()
        self.assertEqual(body['labels'], [1])
        self.assertTrue(body['title'].startswith('Zpětná vazba: '))

    def test_rejects(self):
        cases = [
            (report(kind='spam'), 400),
            (report(message='  '), 400),
            (report(message='x' * 5001), 400),
            (report(email='není e-mail'), 400),
            (report(elapsed=300), 400),
            (report(elapsed=None), 400),
        ]
        for payload, status in cases:
            self.assertEqual(post(self.url, payload)[0], status, payload)
        self.assertEqual(post(self.url, b'{nejson', {})[0], 400)
        self.assertEqual(post(self.url, report(), {'Origin': 'https://zly.example'})[0], 403)
        self.assertEqual(post(self.url, report(), {'Content-Type': 'text/plain'})[0], 415)
        self.assertEqual(self.issues(), [])

    def test_honeypot_pretends_success(self):
        self.assertEqual(post(self.url, report(website='http://spam'))[0], 200)
        self.assertEqual(self.issues(), [])

    def test_rate_limit_per_ip(self):
        for _ in range(3):
            self.assertEqual(post(self.url, report(), {'X-Real-IP': '198.51.100.1'})[0], 201)
        self.assertEqual(post(self.url, report(), {'X-Real-IP': '198.51.100.1'})[0], 429)
        self.assertEqual(post(self.url, report(), {'X-Real-IP': '198.51.100.2'})[0], 201)

    def test_gitea_down_then_retry(self):
        FakeGitea.fail = True
        r = report()
        st, res = post(self.url, r)
        self.assertEqual(st, 502)
        self.assertIn('nepodařilo', res['error'])
        FakeGitea.fail = False
        self.assertEqual(post(self.url, r)[0], 201)        # neuložená zpráva není duplicita

    def test_duplicate_pretends_success(self):
        r = report(email='Jan@Example.com')
        self.assertEqual(post(self.url, r)[0], 201)
        again = dict(r, message=r['message'].upper() + '  ', email='jan@example.com')
        self.assertEqual(post(self.url, again), (200, {'ok': True}))
        self.assertEqual(len(self.issues()), 1)
        self.assertEqual(post(self.url, dict(r, kind='napad'))[0], 201)   # jiný typ už duplicita není

    def test_links_limit(self):
        three = 'Viz https://a.example, http://b.example a www.c.example'
        self.assertEqual(post(self.url, report(message=three))[0], 201)
        st, res = post(self.url, report(message=three + ' a https://d.example'))
        self.assertEqual(st, 400)
        self.assertIn('odkazy', res['error'])
        self.assertIn('links', res['error_en'])

    def test_errors_in_both_languages(self):
        st, res = post(self.url, report(message='a'))
        self.assertEqual((st, res), (400, {'error': 'Napište prosím zprávu.', 'error_en': 'Please write a message.'}))
        st, res = post(self.url, b'{', {'Content-Type': 'application/json'})
        self.assertEqual((st, res['error_en']), (400, 'Invalid form data.'))

    def test_page_language_in_issue(self):
        post(self.url, report(context={'lang': 'de-DE', 'page': 'en'}))
        post(self.url, report())
        [(_, _, en, _), (_, _, cs, _)] = self.issues()
        self.assertIn('z anglické verze', en['body'])
        self.assertIn('| jazyk | de-DE · stránka anglická |', en['body'])
        self.assertNotIn('anglick', cs['body'])          # starší stránka bez context.page = česká
        self.assertIn('stránka česká', cs['body'])

    def test_other_paths(self):
        base = f'http://127.0.0.1:{self.srv.server_port}'
        self.assertEqual(post(base + '/api/jinam', report())[0], 404)
        with self.assertRaises(urllib.error.HTTPError) as e:
            urllib.request.urlopen(self.url, timeout=5)
        self.assertEqual(e.exception.code, 405)


class TestMarkdown(unittest.TestCase):
    def test_code_survives_backticks_and_pipes(self):
        self.assertEqual(server.code('a`b'), '`` a`b ``')
        self.assertEqual(server.code('8|8'), '`8\\|8`')
        self.assertEqual(server.code(''), '_prázdné_')
        self.assertEqual(server.code(True), '`true`')

    def test_fence_longer_than_content(self):
        self.assertTrue(server.fence('```x```', 'json').startswith('````json\n'))

    def test_title_shortened(self):
        r = server.parse(report(message='slovo ' * 30))
        t = server.title_of(r)
        self.assertTrue(t.endswith('…'))
        self.assertLessEqual(len(t), len('Chyba: ') + 72)

    def test_params_dropped_when_huge(self):
        r = server.parse(report(params={'layout': 'x' * 30000}, changed=[['layout', 'x', '88:88']]))
        self.assertIsNone(r['params'])
        self.assertEqual(r['changed'], [])
        self.assertIn('nepřiloženo', server.body_of(r, ''))

    def test_control_chars_removed(self):
        r = server.parse(report(message='a\x00b\r\nc'))
        self.assertEqual(r['message'], 'ab\nc')


class TestLimiter(unittest.TestCase):
    def test_window_and_daily_cap(self):
        lim = server.Limiter(per_ip=2, window=60, per_day=3)
        self.assertTrue(lim.allow('a', 0))
        self.assertTrue(lim.allow('a', 1))
        self.assertFalse(lim.allow('a', 2))
        self.assertTrue(lim.allow('a', 70))
        self.assertFalse(lim.allow('b', 71))          # denní strop pro všechny
        self.assertTrue(lim.allow('b', 86500))


if __name__ == '__main__':
    unittest.main(verbosity=1)
