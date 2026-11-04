#!/bin/bash
# Složí samostatný web do dist/: page.html (obsah stránky ve tvaru pro Claude Artifact)
# se doplní o <!doctype>, <head> a <body>, přibudou moduly a WASM jádro.
set -euo pipefail
cd "$(dirname "$0")"
rm -rf dist
mkdir -p dist
python3 -I - <<'EOF'
src = open('page.html', encoding='utf-8').read()
cut = src.index('<div class="app">')
head, body = src[:cut], src[cut:]
favicon = ("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 22 36'%3E"
           "%3Cg fill='%23d93b1b'%3E%3Cpath d='M5 2h12l-2 3H7z'/%3E%3Cpath d='M4 4l2 3v8l-1 2-2-1V5z'/%3E"
           "%3Cpath d='M6 17h10l2 1-2 1H6l-2-1z'/%3E%3Cpath d='M18 19l1 1v11l-1 1-2-2v-9z'/%3E"
           "%3Cpath d='M7 31h8l2 3H5z'/%3E%3C/g%3E%3C/svg%3E")
doc = f"""<!doctype html>
<html lang="cs">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<link rel="icon" href="{favicon}">
<style>:root{{color-scheme:light;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}}body{{margin:0;font:14px system-ui,sans-serif}}img{{max-width:100%}}[hidden]{{display:none!important}}</style>
{head.strip()}
</head>
<body>
{body.strip()}
</body>
</html>
"""
open('dist/index.html', 'w', encoding='utf-8').write(doc)
EOF
cp gen.js symbols.js split.js export.js worker.js manifold.js manifold.wasm manifold-LICENSE.txt dist/
echo "dist/ připraven: $(du -sh dist | cut -f1)"
