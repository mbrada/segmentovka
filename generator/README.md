# Segmentovka – generátor pouzdra 7segmentového displeje

Webový generátor pouzdra pro 7segmentový displej z kulatých modulů WS2812B (⌀ 10 mm),
které se zezadu jen zacvaknou do lůžka. Vychází z pouzdra `Case.3mf` (hodiny 88:88) z modelu
[7 segment LED clock](https://www.printables.com/model/325415-7-segment-led-clock) od AWSW
(CC BY-NC 4.0; v repozitáři není, je na Printables). Výchozí parametry ho reprodukují
(objem 258,7 vs. 259,6 cm³, řezy se shodují).
Licence generátoru: GNU AGPL-3.0-or-later, podrobnosti v `../README.md`.

Běží na https://segmentovka.miloslavbrada.cz

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
- `page.html` – stránka (obsah ve tvaru pro Claude Artifact, bez `<head>`)
- `consent.js` – Google Analytics (G-GX5DWNWRNJ) se souhlasem: Consent Mode v2 v základním režimu,
  `gtag.js` se načte až po kliknutí na Přijmout; volba v `localStorage` na 12 měsíců, odvolání
  odkazem Nastavení cookies v patičce (smaže cookies `_ga*`); `build.sh` ho vkládá jen do `dist/`
- `feedback.js` – zpětná vazba: tlačítko pod Častými otázkami a v patičce otevře formulář (chyba / nápad /
  dotaz / jiné, zpráva, nepovinný e-mail, volitelně přiložené nastavení z `localStorage` – rozložení, změněné
  parametry a celý `parametry.json`) a odešle ho na `api/zpetna-vazba`; rozepsaný text se pamatuje
  v `localStorage`, `#zpetna-vazba` v adrese formulář rovnou otevře; `build.sh` ho vkládá jen do `dist/`
  (v Claude Artifact žádný backend není); patičku sdílí s `consent.js`
- `zpetna-vazba/` – služba za tím formulářem (Python, jen standardní knihovna), viz Zpětná vazba níže
- `manifold.js`, `manifold.wasm` – manifold-3d 3.5.4 (Apache-2.0, `manifold-LICENSE.txt`)
- `build.sh` – složí samostatný web do `dist/`; přidá SEO hlavičku (canonical, Open Graph,
  JSON-LD WebApplication z `<title>` a description v `page.html`), `robots.txt` a `sitemap.xml`
- `og.png` – náhled odkazu 1200 × 630; vzniká z `tools/og.mjs` (displej z generátoru) přes Inkscape
- `deploy.sh` – sestaví a nasadí `dist/` na server (`/srv/www/segmentovka`, nginx);
  službu zpětné vazby nasazuje zvlášť `zpetna-vazba/deploy.sh`

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

Hlášení z formuláře nejsou v žádné databázi – každé je issue v soukromém repozitáři
[autor/segmentovka](https://gitea.example.org/autor/segmentovka/issues) se štítkem `zpětná vazba`
a `chyba` / `nápad` / `dotaz`. Zakládá je uživatel `segmentovka-bot` (typ bot, spolupracovník repozitáře
s právem zápisu, token jen se scope `write:issue`), takže majiteli repozitáře přijde na každé hlášení
e-mail od Gitea. V issue je zpráva, kontakt s odkazem na odpověď e-mailem, změněné parametry, celý
`parametry.json` (jde načíst tlačítkem Načíst parametry…), upozornění generátoru a prohlížeč.

`zpetna-vazba/server.py` běží na server jako `segmentovka-zpetna-vazba.service` (`DynamicUser`, síť jen na
localhost) na 127.0.0.1:24790 a nginx mu předává `POST /api/zpetna-vazba`; Gitea volá napřímo na
127.0.0.1:3000. Proti spamu (bez CAPTCHA a třetích stran):

- skryté pole pro roboty – vyplněné se tváří jako odeslané, issue nevznikne
- formulář musí být otevřený aspoň 2 s
- jen JSON a kontrola `Origin` – z cizí stránky ani obyčejným odesláním HTML formuláře to nejde
- víc než 3 odkazy ve zprávě se odmítnou
- stejná zpráva (typ, text bez ohledu na velikost písmen a mezery, e-mail) znovu do hodiny issue
  nezaloží a tváří se jako odeslaná – i dvojklik
- 5 zpráv za 10 minut z jedné IP, 50 za den celkem; v nginx navíc 6 požadavků za minutu
- zpráva nejvýš 5000 znaků, požadavek 64 kB

Kdyby spam přesto chodil, další stupeň je neviditelný proof-of-work v prohlížeči nebo Cloudflare Turnstile. Nasazení `zpetna-vazba/deploy.sh` (spustí testy, vymění kód a restartuje službu),
log `journalctl -u segmentovka-zpetna-vazba`.

Jednorázové nastavení na server (Gitea běží v Dockeru jako kontejner `gitea`):

    # bot nemá heslo a přihlásit se nemůže, Gitea mu neposílá e-maily
    gitea admin user create --user-type bot --username segmentovka-bot \
      --email 'bot@example.org'
    # spolupracovník s právem zápisu (štítky jde nastavit jen se zápisem): v Gitea Nastavení repozitáře →
    # Spolupracovníci, nebo API s tokenem správce:
    #   PUT /api/v1/repos/autor/segmentovka/collaborators/segmentovka-bot  {"permission": "write"}
    install -d -m 700 /etc/segmentovka-zpetna-vazba
    gitea admin user generate-access-token --username segmentovka-bot \
      --token-name zpetna-vazba --scopes write:issue --raw > /etc/segmentovka-zpetna-vazba/gitea-token
    chmod 600 /etc/segmentovka-zpetna-vazba/gitea-token

Štítky si služba při prvním hlášení založí sama. Nginx config na serveru `deploy.sh` po certbotu
nepřepisuje – blok `location = /api/zpetna-vazba` a `limit_req_zone` z `deploy/nginx.conf` jsou v něm
doplněné ručně.
