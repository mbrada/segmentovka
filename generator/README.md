# Segmentovka – generátor pouzdra 7segmentového displeje

Webový generátor pouzdra pro 7segmentový displej z kulatých modulů WS2812B (⌀ 10 mm),
které se zezadu jen zacvaknou do lůžka. Vychází z `../Case.3mf` (hodiny 88:88);
výchozí parametry ho reprodukují (objem 258,7 vs. 259,6 cm³, řezy se shodují).

Běží na https://segmentovka.miloslavbrada.cz

- styly segmentů: hroty 45° (originál), šikmé rohy (klasický LED), zaoblené, rovné (blokové)
- rozložení libovolným řetězcem: `8` číslice, `1` úzká jednička, `-` mínus, `:` dvojtečka,
  `.` desetinná tečka, `°` stupeň, mezera
- výstupy: pouzdro (tisk čelem dolů), difuzory do 1mm vybrání, zadní krabička se sloupky,
  otvorem pro kabel a otvory na zavěšení; 3MF má pouzdro a difuzory jako dva díly jednoho
  objektu (tisk s AMS), mapa LED pro firmware

## Soubory

- `gen.js` – rozložení a 3D geometrie (CSG přes manifold-3d), sdílené prohlížečem i Node
- `export.js` – binární STL, 3MF, ZIP (deflate přes CompressionStream)
- `worker.js` – výpočet ve Web Workeru
- `page.html` – stránka (obsah ve tvaru pro Claude Artifact, bez `<head>`)
- `manifold.js`, `manifold.wasm` – manifold-3d 3.5.4 (Apache-2.0, `manifold-LICENSE.txt`)
- `build.sh` – složí samostatný web do `dist/`
- `deploy.sh` – sestaví a nasadí `dist/` na server (`/srv/www/segmentovka`, nginx)

## Lokálně

    ./build.sh && python3 -m http.server 8000 --directory dist   # http://localhost:8000

ES moduly a WASM potřebují HTTP, z `file://` stránka nepoběží.

## Testy

    node test/build.mjs /tmp/out '{"layout":"-8:8:8","slant":8}'   # STL + statistika (manifold, objem)
    node test/export.mjs /tmp/out                                  # ZIP a 3MF
    node test/genus.mjs                                            # světlovody průchozí ve všech stylech
