#!/bin/bash
# SPDX-License-Identifier: AGPL-3.0-or-later
# Copyright (C) 2026 Miloslav Brada
# Složí samostatný web do dist/: page.html (obsah stránky ve tvaru pro Claude Artifact)
# se doplní o <!doctype>, <head> a <body>, přibudou moduly a WASM jádro.
# Ze stejné page.html vzniká i anglická verze dist/en/: statické HTML se přeloží podle
# page.en.py, texty v JS se přepnou za běhu (T() v i18n.js podle lang). Moduly jsou společné,
# anglická stránka na ně míří přes <base href="../">.
set -euo pipefail
cd "$(dirname "$0")"
rm -rf dist
mkdir -p dist/en
python3 -I - <<'EOF'
import ast, datetime, json, re, sys
from html import escape
from html.parser import HTMLParser

SITE = 'https://segmentovka.miloslavbrada.cz/'
src = open('page.html', encoding='utf-8').read()

# ---------- překlad statického HTML ----------
# Kód (<script>, <style>) a komentáře se nepřekládají; dvojice z page.en.py se hledají jen ve
# značkování mezi nimi a každá tam musí být přesně tolikrát, kolikrát je uvedeno.
CODE = re.compile(r'<script\b.*?</script>|<style\b.*?</style>|<!--.*?-->', re.S)

def parts(s):
    out, pos = [], 0
    for m in CODE.finditer(s):
        out += [(False, s[pos:m.start()]), (True, m.group(0))]
        pos = m.end()
    return out + [(False, s[pos:])]

def translate(s, pairs):
    ps, errors = parts(s), []
    for pair in pairs:
        cs, en = pair[0], pair[1]
        want = pair[2] if len(pair) > 2 else 1
        n = sum(t.count(cs) for code, t in ps if not code)
        if n != want:
            errors.append(f'{n}× místo {want}×: {cs[:100]}')
            continue
        ps = [(code, t if code else t.replace(cs, en)) for code, t in ps]
    return ''.join(t for _, t in ps), errors

class Texts(HTMLParser):
    """Texty, které vidí návštěvník: textové uzly mimo <script>, <style> a <code> a atributy
    title, aria-label, alt, placeholder a obsah meta description."""
    ATTRS = ('title', 'aria-label', 'alt', 'placeholder')
    def __init__(self, s):
        super().__init__(convert_charrefs=True)
        self.found, self.raw, self.code = set(), 0, 0
        self.feed(s)
        self.close()
    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag in ('script', 'style'): self.raw += 1
        if tag == 'code': self.code += 1
        for k in self.ATTRS:
            if a.get(k): self.found.add(' '.join(a[k].split()))
        if tag == 'meta' and a.get('name') == 'description': self.found.add(a.get('content', ''))
    def handle_startendtag(self, tag, attrs):
        a = dict(attrs)
        for k in self.ATTRS:
            if a.get(k): self.found.add(' '.join(a[k].split()))
        if tag == 'meta' and a.get('name') == 'description': self.found.add(a.get('content', ''))
    def handle_endtag(self, tag):
        if tag in ('script', 'style'): self.raw -= 1
        if tag == 'code': self.code -= 1
    def handle_data(self, d):
        d = ' '.join(d.split())
        if d and not self.raw and not self.code: self.found.add(d)

en_data = ast.literal_eval(open('page.en.py', encoding='utf-8').read())
src_en, errors = translate(src, en_data['pairs'])
neutral = set(en_data['neutral'])
left = sorted(t for t in Texts(src).found & Texts(src_en).found
              if t not in neutral and re.search(r'[^\W\d_]', t))
errors += [f'nepřeloženo: {t[:100]}' for t in left]
if errors:
    sys.exit('page.en.py nesedí na page.html:\n  ' + '\n  '.join(errors))

# ---------- obě jazykové verze ----------
LANGS = {
    'cs': dict(src=src, out='dist/index.html', url=SITE, locale='cs_CZ', og='og.png', base='',
               og_alt='Svítící 7segmentový displej 12:45 ve stylu LCD', os='webový prohlížeč', nav='Jazyk',
               shot_alt='3D náhled pouzdra hodin 88:88 s difuzory segmentů, pohled šikmo zepředu'),
    'en': dict(src=src_en, out='dist/en/index.html', url=SITE + 'en/', locale='en_US', og='og-en.png',
               base='<base href="../">\n', og_alt='A glowing 7-segment display showing 12:45 in the LCD style',
               os='web browser', nav='Language',
               shot_alt='3D preview of an 88:88 clock case with segment diffusers, oblique front view'),
}
# obrázek 3D náhledu v popisu generátoru (vzniká z tools/nahled.mjs); jen pro samostatný web,
# v Claude Artifact by relativní adresa nevedla nikam
SHOT = 'nahled.webp'
# x-default: kdo nemluví česky, dostane angličtinu
ALT = {'cs': SITE, 'en': SITE + 'en/', 'x-default': SITE + 'en/'}

for lang, L in LANGS.items():
    page = L['src']
    cut = page.index('<div class="app"')
    head, body = page[:cut], page[cut:]
    title = re.search(r'<title>(.*?)</title>', head).group(1)
    desc = re.search(r'<meta name="description" content="(.*?)">', head).group(1)
    ld = json.dumps({'@context': 'https://schema.org', '@graph': [
        {'@type': 'WebSite', 'name': 'Segmentovka', 'url': SITE, 'inLanguage': ['cs', 'en']},
        {'@type': 'WebApplication', 'name': 'Segmentovka', 'url': L['url'],
         'description': desc, 'inLanguage': lang, 'applicationCategory': 'DesignApplication',
         'operatingSystem': L['os'], 'isAccessibleForFree': True, 'image': [SITE + SHOT, SITE + L['og']],
         'offers': {'@type': 'Offer', 'price': '0', 'priceCurrency': 'CZK'}},
    ]}, ensure_ascii=False)
    other = 'en' if lang == 'cs' else 'cs'
    # vyhledávače a náhledy odkazů (Open Graph); jen pro samostatný web, v page.html nejsou
    seo = '\n'.join([
        f'<link rel="canonical" href="{L["url"]}">',
        *[f'<link rel="alternate" hreflang="{h}" href="{u}">' for h, u in ALT.items()],
        '<meta property="og:type" content="website">',
        '<meta property="og:site_name" content="Segmentovka">',
        f'<meta property="og:locale" content="{L["locale"]}">',
        f'<meta property="og:locale:alternate" content="{LANGS[other]["locale"]}">',
        f'<meta property="og:url" content="{L["url"]}">',
        f'<meta property="og:title" content="{title}">',
        f'<meta property="og:description" content="{desc}">',
        f'<meta property="og:image" content="{SITE}{L["og"]}">',
        '<meta property="og:image:width" content="1200">',
        '<meta property="og:image:height" content="630">',
        f'<meta property="og:image:alt" content="{escape(L["og_alt"])}">',
        '<meta name="twitter:card" content="summary_large_image">',
        '<meta name="theme-color" content="#0d0f0e">',
        f'<script type="application/ld+json">{ld}</script>',
    ])
    # přepínač jazyka; odkazy jsou relativní ke kořeni webu (anglická verze má <base href="../">)
    cur = lambda l: ' aria-current="page"' if l == lang else ''
    nav = (f'<nav class="langs" aria-label="{L["nav"]}">'
           f'<a href="./" lang="cs" hreflang="cs" title="Česky"{cur("cs")}>CS</a>'
           f'<a href="en/" lang="en" hreflang="en" title="English"{cur("en")}>EN</a></nav>')
    if body.count('<!--lang-switch-->') != 1:
        sys.exit('page.html: chybí <!--lang-switch--> v hlavičce')
    body = body.replace('<!--lang-switch-->', nav)
    if body.count('<!--nahled-->') != 1:
        sys.exit('page.html: chybí <!--nahled--> v popisu generátoru')
    body = body.replace('<!--nahled-->', f'<img class="about-shot" src="{SHOT}" width="1200" height="750" '
                        f'alt="{escape(L["shot_alt"])}" loading="lazy" decoding="async">')
    doc = f"""<!doctype html>
<html lang="{lang}">
<head>
<meta charset="utf-8">
{L['base']}<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<link rel="icon" href="favicon.ico" sizes="48x48">
<link rel="icon" href="favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="apple-touch-icon.png">
{seo}
<style>:root{{color-scheme:light;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}}body{{margin:0;font:14px system-ui,sans-serif}}img{{max-width:100%}}[hidden]{{display:none!important}}</style>
<script src="consent.js"></script>
{head.strip()}
</head>
<body>
{body.strip()}
<script type="module" src="feedback.js"></script>
</body>
</html>
"""
    open(L['out'], 'w', encoding='utf-8').write(doc)

today = datetime.date.today().isoformat()
links = ''.join(f'\n    <xhtml:link rel="alternate" hreflang="{h}" href="{u}"/>' for h, u in ALT.items())
images = lambda L: ''.join(f'\n    <image:image><image:loc>{SITE}{img}</image:loc></image:image>' for img in (SHOT, L['og']))
urls = ''.join(f'\n  <url>\n    <loc>{L["url"]}</loc>\n    <lastmod>{today}</lastmod>{links}{images(L)}\n  </url>'
               for L in LANGS.values())
open('dist/sitemap.xml', 'w').write('<?xml version="1.0" encoding="UTF-8"?>\n'
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml"'
    ' xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">'
    f'{urls}\n</urlset>\n')
open('dist/robots.txt', 'w').write(f'User-agent: *\nAllow: /\n\nSitemap: {SITE}sitemap.xml\n')
EOF
cp consent.js feedback.js og.png og-en.png nahled.webp favicon.svg favicon.ico apple-touch-icon.png i18n.js gen.js symbols.js split.js export.js worker.js manifold.js manifold.wasm manifold-LICENSE.txt dist/
echo "dist/ připraven: $(du -sh dist | cut -f1)"
