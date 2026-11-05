# Segmentovka – generátor pouzdra 7segmentového displeje

Webový generátor pouzdra pro 7segmentový displej z kulatých modulů WS2812B (⌀ 10 mm),
které se zezadu jen zacvaknou do lůžka. Vychází z pouzdra `Case.3mf` (hodiny 88:88) z modelu
[7 segment LED clock](https://www.printables.com/model/325415-7-segment-led-clock) od AWSW
(CC BY-NC 4.0; v repozitáři není, je na Printables). Výchozí parametry ho reprodukují
(objem 258,7 vs. 259,6 cm³, řezy se shodují).
Licence generátoru: GNU AGPL-3.0-or-later, podrobnosti v `../README.md`.

Běží na https://segmentovka.miloslavbrada.cz, anglicky na https://segmentovka.miloslavbrada.cz/en/

## Jazyky

Stránka je česky a anglicky, obě verze skládá `build.sh` z jedné `page.html`:

- statické HTML (záhlaví, popis, časté otázky, patička, `<title>`, description) přeloží podle dvojic
  v `page.en.py`; každá česká část musí v `page.html` být právě jednou (nebo tolikrát, kolikrát je
  u dvojice uvedeno) a český text nebo atribut (`title`, `aria-label`, `alt`, `placeholder`), který
  v anglické verzi zůstane, build nahlásí jako nepřeložený – kromě seznamu `neutral`
- texty v JS jsou přímo v kódu dvakrát vedle sebe: `T('česky', 'English')` z `i18n.js`; jazyk se bere
  z `lang` na `<div class="app">` (v Node a ve workeru je čeština), čísla se formátují podle něj
  (`cs-CZ` / `en-US`) – i varování z `gen.js` a `split.js`, mapa LED (`SYM_TEMP` místo `SYM_TEPLOTA`),
  názvy souborů v ZIPu (`_case.stl`, `_params.json`, `README.txt`) a díly v 3MF
- `dist/en/index.html` má `<base href="../">`, takže moduly, WASM i `api/zpetna-vazba` jsou společné;
  obě verze mají `hreflang` (x-default je angličtina), sitemap s alternativami, vlastní Open Graph
  (`og-en.png`) a vpravo nahoře přepínač CS / EN (jen samostatný web, místo `<!--lang-switch-->`)
- uložené parametry, kóty, koncept zpětné vazby i souhlas s cookies sdílí obě verze (stejný `localStorage`)

- styly segmentů: hroty 45° (originál), šikmé rohy (klasický LED), zaoblené, rovné (blokové)
  a LCD – asymetrické segmenty jako DSEG7 Modern: spáry pod 30°/60°, každý vnější roh patří
  jednomu segmentu a je zaoblený; tlačítko stylu nastaví těsnou mezeru 1,5 mm
- rozložení libovolným řetězcem: `8` číslice, `1` úzká jednička, `-` mínus, `:` dvojtečka,
  `.` desetinná tečka, `°` stupeň, mezera
- symboly v hranatých závorkách, např. `88.8[cm]`, `-88.8[°C]`: v čele maska s vyříznutým
  šablonovým písmem, svítí ji jedna LED přes společný světlovod (písmo v `symbols.js`)
- sloupec symbolů pod sebou, každý se svou LED: `888.8[°C|%|hPa|ppm]` – meteostanice
  (teplota, vlhkost, tlak, CO₂); tlačítka „Meteostanice“ zapínají jednotlivé veličiny
  nebo všechny, písmo se do výšky číslice případně zmenší; mapa LED má `SYM_TEPLOTA` …
- šablonové písmo: očka písmen (O, °, %, P…) mají přerušení, aby z masky nic nevypadlo;
  při tisku difuzorů na místě (vůle 0) je písmo automaticky souvislé – vnitřky písmen
  drží destička difuzoru (volba „Šablonové písmo“: automaticky / vždy / nikdy)
- výstupy: pouzdro (tisk čelem dolů), difuzory do 1mm vybrání, zadní krabička se sloupky,
  otvorem pro kabel a otvory na zavěšení (klíčová dírka `KEYHOLE`; rozteč `keyholeGap`,
  0 = automaticky ve čtvrtinách šířky nebo uprostřed horních dílů; od horní hrany `keyholeTop`;
  ze zóny spojů dílů se odsunou); 3MF má pouzdro a difuzory jako dva díly jednoho
  objektu (tisk s AMS), mapa LED pro firmware
- otvor pro kabel: v boku krabičky (vlevo, vpravo, dole, nahoře) nebo v zadní stěně v mřížce
  3 × 3; volí se obrázkem krabičky v čelním pohledu a sám uhne sloupkům, otvorům na zavěšení
  a spojům dílů (`USB_PORTS`, `cablePort` v `gen.js`)
- čepy sloupků: sloupky pouzdra jsou o `postSink` nižší a sloupky krabičky do nich zasahují
  čepem s vůlí `postFit` ke stěnám – tužší spoj a krabička sedí přesně; délka šroubů se podle
  toho přepočítá (`lidScrewLen`)
- čelní pohled umí kóty: okraje, šířka a výška číslice, mezera, tloušťka segmentu, celkové
  rozměry, rozteč otvorů na zavěšení a jejich vzdálenost od horní hrany, hloubka v popisku;
  čísla kót jdou měnit kolečkem myši (o krok parametru, se Shiftem ×10), šipkami, nebo kliknutím
  a zadáním hodnoty – odvozené kóty (celková šířka a výška, okraj nahoře a dole, čepy) se
  dopočítají přes parametr, na kterém závisí (`DIM_BIND` v `page.html`); kóty otvorů na
  zavěšení otvory posouvají (rozteč souměrně kolem středu, vzdálenost od horní hrany), velikost
  pouzdra nemění; kóty, které měnit nejde (např. otvory u tří a více horních dílů), jsou šedé;
  kótuje se podle ČSN EN ISO 129-1 – plné šipky, u krátkých kót zvenku, číslo nad kótovací
  čarou, svislé čitelné zprava, otvory k osám (čerchovaně); změny z kót jdou
  vrátit tlačítkem „Vrátit změny kót“ nebo po jedné v dialogu kóty (na hodnotu před změnami
  ve výkresu; změna parametru v panelu se bere jako nový výchozí bod)
- popisek pod čelním pohledem se zalamuje do šířky výkresu, u úzkých pouzder se zmenší písmo
- dělení na díly (`split.js`): když se pouzdro nevejde na tiskovou plochu, rozdělí se rovnými
  řezy, které nevedou přes lůžka LED a co nejméně přes světlovody; na spoji mají díly stěny
  s rybinovými zámky (zasunou se zezadu) a/nebo šrouby M3 s maticí, ve stěnách jsou výřezy pro
  vodiče otevřené dozadu; kde u čela není místo, jsou zámky a šrouby jen v zadní části stěny
  se sraženou spodní hranou; stejně se dělí i krabička

## Soubory

- `gen.js` – rozložení a 3D geometrie (CSG přes manifold-3d), sdílené prohlížečem i Node
- `symbols.js` – šablonové písmo symbolů (tahy, bez ostrůvků)
- `split.js` – volba řezů a rozmístění zámků, šroubů a výřezů pro vodiče na spojích
- `export.js` – binární STL, 3MF, ZIP (deflate přes CompressionStream)
- `worker.js` – výpočet ve Web Workeru
- `page.html` – stránka (obsah ve tvaru pro Claude Artifact, bez `<head>`), česky
- `page.en.py` – anglické texty statického HTML z `page.html` (viz Jazyky)
- `i18n.js` – jazyk stránky a `T('česky', 'English')` pro texty v JS
- `consent.js` – Google Analytics (G-GX5DWNWRNJ) se souhlasem: Consent Mode v2 v základním režimu,
  `gtag.js` se načte až po kliknutí na Přijmout; volba v `localStorage` na 12 měsíců, odvolání
  odkazem Nastavení cookies v patičce (smaže cookies `_ga*`); `build.sh` ho vkládá jen do `dist/`
- `feedback.js` – zpětná vazba: tlačítko pod Častými otázkami a v patičce otevře formulář (chyba / nápad /
  dotaz / jiné, zpráva, nepovinný e-mail, volitelně přiložené nastavení z `localStorage` – rozložení, změněné
  parametry a celý `parametry.json`) a odešle ho na `api/zpetna-vazba`; rozepsaný text se pamatuje
  v `localStorage`, `#zpetna-vazba` (nebo `#feedback`) v adrese formulář rovnou otevře; `build.sh` ho vkládá jen do `dist/`
  (v Claude Artifact žádný backend není); patičku sdílí s `consent.js`
- `zpetna-vazba/` – služba za tím formulářem (Python, jen standardní knihovna), viz Zpětná vazba níže
- `manifold.js`, `manifold.wasm` – manifold-3d 3.5.4 (Apache-2.0, `manifold-LICENSE.txt`)
- `build.sh` – složí samostatný web do `dist/` (česky) a `dist/en/` (anglicky); přidá SEO hlavičku
  (canonical, hreflang, Open Graph, JSON-LD WebApplication z `<title>` a description), `robots.txt`
  a `sitemap.xml`
- `og.png`, `og-en.png` – náhled odkazu 1200 × 630; vzniká z `tools/og.mjs` (displej z generátoru,
  `node tools/og.mjs og-en.svg en` pro anglický) přes Inkscape

Nasazení a konfigurace serveru nejsou součástí repozitáře (autor je má v soukromé složce `provoz/`,
kterou `.gitignore` vynechává). Web je statický – stačí obsah `dist/` na libovolném HTTP serveru;
zpětná vazba navíc potřebuje službu z `zpetna-vazba/` za reverzní proxy.

## Lokálně

    ./build.sh && python3 -m http.server 8000 --directory dist   # http://localhost:8000
    ./build.sh && zpetna-vazba/server.py serve --dry-run --static dist --port 8000
                                       # totéž i se zpětnou vazbou, issue se jen vypíše do terminálu

ES moduly a WASM potřebují HTTP, z `file://` stránka nepoběží.

## Testy

    node test/build.mjs /tmp/out '{"layout":"-8:8:8","slant":8}'   # STL + statistika (manifold, objem)
    node test/export.mjs /tmp/out                                  # ZIP a 3MF
    node test/genus.mjs                                            # světlovody, ostrůvky, dělení na díly
    python3 zpetna-vazba/test_server.py                            # služba zpětné vazby proti falešné Gitea

## Zpětná vazba

Hlášení z formuláře nejsou v žádné databázi – každé je issue v soukromém repozitáři v Gitea se štítkem
`zpětná vazba` a `chyba` / `nápad` / `dotaz`. Zakládá je samostatný uživatel typu bot (spolupracovník
repozitáře s právem zápisu – bez něj nejdou štítky – a token jen se scope `write:issue`), takže majiteli
repozitáře přijde na každé hlášení e-mail od Gitea. V issue je zpráva, kontakt s odkazem na odpověď
e-mailem, změněné parametry, celý `parametry.json` (jde načíst tlačítkem Načíst parametry…), upozornění
generátoru a prohlížeč. Hlášení z anglické verze to mají v prvním řádku („z anglické verze – odpovídat
anglicky“, stránka posílá `context.page`). Chybové hlášky vrací služba česky (`error`) i anglicky
(`error_en`), formulář si vezme tu svou. Štítky si služba při prvním hlášení založí sama.

`zpetna-vazba/server.py` (jen standardní knihovna Pythonu) poslouchá na 127.0.0.1:24790 a reverzní proxy
mu předává `POST /api/zpetna-vazba` s hlavičkou `X-Real-IP`; token čte ze souboru od systemd
(`LoadCredential`, `$CREDENTIALS_DIRECTORY/gitea-token`) nebo z `--token-file`. Když volá Gitea napřímo
(např. `--gitea http://127.0.0.1:3000`), potřebuje `--gitea-public` s veřejnou adresou – Gitea podle ní
skládá odkazy v e-mailech. Proti spamu (bez CAPTCHA a třetích stran):

- skryté pole pro roboty – vyplněné se tváří jako odeslané, issue nevznikne
- formulář musí být otevřený aspoň 2 s
- jen JSON a kontrola `Origin` – z cizí stránky ani obyčejným odesláním HTML formuláře to nejde
- víc než 3 odkazy ve zprávě se odmítnou
- stejná zpráva (typ, text bez ohledu na velikost písmen a mezery, e-mail) znovu do hodiny issue
  nezaloží a tváří se jako odeslaná – i dvojklik
- 5 zpráv za 10 minut z jedné IP, 50 za den celkem; v proxy navíc omezení počtu požadavků
- zpráva nejvýš 5000 znaků, požadavek 64 kB

Kdyby spam přesto chodil, další stupeň je neviditelný proof-of-work v prohlížeči nebo Cloudflare Turnstile.
