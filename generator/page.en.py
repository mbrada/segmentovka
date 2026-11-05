# SPDX-License-Identifier: AGPL-3.0-or-later
# Copyright (C) 2026 Miloslav Brada
#
# Anglické texty statického HTML z page.html pro dist/en/ (texty v JS jsou přímo v kódu jako
# T('česky', 'English'), viz i18n.js). build.sh soubor načte přes ast.literal_eval – jen data.
#
# pairs: (česky, anglicky[, počet]) – nahrazuje se jen ve značkování (mimo <script>, <style>
#   a komentáře) a česká část musí v page.html být přesně tolikrát (výchozí 1), jinak build skončí
#   chybou. Po úpravě českého textu v page.html je tedy potřeba upravit i dvojici tady.
# neutral: texty, které jsou v obou jazycích stejné; každý jiný český text nebo atribut
#   (title, aria-label, alt, placeholder, meta description), který v anglické verzi zůstane,
#   build nahlásí jako nepřeložený.
{
'neutral': [
    'Segmentovka', '3D model', '3MF', 'mm', 'LCD', '7 segment LED clock', 'CC BY-NC 4.0', 'GNU AGPL-3.0',
    'Miloslav Brada',
],
'pairs': [
# ---------- hlavička dokumentu ----------
('<title>Segmentovka – generátor pouzdra pro 7segmentový displej z WS2812B</title>',
 '<title>Segmentovka – 7-segment display case generator for WS2812B LEDs</title>'),
('content="Navrhněte si 3D tisknutelné pouzdro pro velký 7segmentový displej z LED WS2812B – hodiny, teploměr, meteostanice. Export STL a 3MF, difuzory i mapa LED."',
 'content="Design a 3D-printable case for a large 7-segment display made of WS2812B LEDs – a clock, thermometer or weather station. STL and 3MF export, diffusers and an LED map."'),
('<div class="app" lang="cs">', '<div class="app" lang="en">'),

# ---------- záhlaví a rozložení ----------
('<p>Pouzdro pro 7segmentový displej z modulů WS2812B. Modul se zezadu jen zacvakne do lůžka a světlovod vede světlo k segmentu. Výchozí hodnoty odpovídají osvědčeným hodinám 88:88.</p>',
 '<p>A case for a 7-segment display built from WS2812B modules. Each module simply snaps into a socket from the back and a light guide carries its light to the segment. The defaults match a proven 88:88 clock.</p>'),
('<label for="p-layout">Rozložení displeje</label>', '<label for="p-layout">Display layout</label>'),
('aria-label="Předvolby rozložení"', 'aria-label="Layout presets"'),
('aria-label="Meteostanice: veličiny ve sloupci symbolů"><span class="chips-label">Meteostanice</span>',
 'aria-label="Weather station: quantities in the symbol column"><span class="chips-label">Weather station</span>'),
('aria-label="Vložit symbol"><span class="chips-label">Vložit symbol</span>',
 'aria-label="Insert a symbol"><span class="chips-label">Insert symbol</span>'),
('<code>8</code> číslice · <code>1</code> úzká jednička · <code>-</code> mínus · <code>:</code> dvojtečka · <code>.</code> desetinná tečka · <code>°</code> stupeň · <code>[cm]</code> symbol za jednou LED · <code>[°C|%]</code> symboly pod sebou · mezera',
 '<code>8</code> digit · <code>1</code> narrow one · <code>-</code> minus · <code>:</code> colon · <code>.</code> decimal point · <code>°</code> degree · <code>[cm]</code> symbol lit by one LED · <code>[°C|%]</code> stacked symbols · space'),

# ---------- náhled ----------
('aria-label="Náhled"', 'aria-label="Preview"'),
('>Čelní pohled a pořadí LED<', '>Front view and LED order<'),
('aria-pressed="true">Zezadu<', 'aria-pressed="true">Back<'),
('aria-pressed="false">Zepředu<', 'aria-pressed="false">Front<'),
('aria-pressed="false">Šikmo<', 'aria-pressed="false">Angled<'),
('id="v-diff" checked>Difuzory<', 'id="v-diff" checked>Diffusers<'),
('id="v-lid">Krabička<', 'id="v-lid">Back box<'),
('id="v-cut">Řez<', 'id="v-cut">Section<'),
('id="v-dims">Kóty<', 'id="v-dims">Dimensions<'),
('>čísla měníte kolečkem myši nebo kliknutím<', '>change the numbers with the mouse wheel or by clicking<'),
('>Vrátit změny kót<', '>Undo dimension changes<'),
('>Načítám geometrické jádro…<', '>Loading the geometry kernel…<'),
('aria-label="Parametry"', 'aria-label="Parameters"'),

# ---------- výstupy ----------
('<h2>Rozměry a díly</h2>', '<h2>Dimensions and parts</h2>'),
('<h2>Export pro tisk</h2>', '<h2>Export for printing</h2>'),
('>Stáhnout vše (ZIP)<', '>Download all (ZIP)<'),
('>Pouzdro STL<', '>Case STL<'),
('>Difuzory STL<', '>Diffusers STL<'),
('>Krabička STL<', '>Back box STL<'),
('>ZIP obsahuje STL všech dílů, 3MF (pouzdro s difuzory jako dva díly jednoho objektu), mapu LED a parametry.<',
 '>The ZIP contains STL files of all parts, a 3MF (the case with diffusers as two parts of one object), the LED map and the parameters.<'),
('<li>Pouzdro tiskněte čelem dolů, podpěry nejsou potřeba.</li>',
 '<li>Print the case face down, no supports needed.</li>'),
('<li>Difuzory: 1 mm bílého nebo průsvitného PETG/PLA. S AMS nastavte vůli 0 a v 3MF jim přiřaďte jiný filament – vytisknou se rovnou v pouzdře.</li>',
 '<li>Diffusers: 1 mm of white or translucent PETG/PLA. With an AMS, set the clearance to 0 and assign them a different filament in the 3MF – they print right inside the case.</li>'),
('<li>Krabička se tiskne zadní deskou dolů.</li>',
 '<li>Print the back box with its back plate down.</li>'),
('<h2>Mapa LED pro firmware</h2>', '<h2>LED map for firmware</h2>'),
('id="copy-map">Zkopírovat<', 'id="copy-map">Copy<'),

# ---------- o generátoru ----------
('aria-label="O generátoru"', 'aria-label="About the generator"'),
('<h2>Generátor pouzdra pro 7segmentový displej z LED WS2812B</h2>',
 '<h2>Case generator for 7-segment displays made of WS2812B LEDs</h2>'),
('<p>Segmentovka navrhne 3D tisknutelné pouzdro pro velký sedmisegmentový displej, který svítí adresovatelnými LED WS2812B (NeoPixel). Každý segment má vlastní světlovod a za ním lůžko, do kterého se zezadu jen zacvakne kulatý modul s jednou LED. Pájí se jen vodiče mezi moduly – žádný plošný spoj ani lepení.</p>',
 '<p>Segmentovka designs a 3D-printable case for a large seven-segment display lit by addressable WS2812B LEDs (NeoPixel). Every segment has its own light guide with a socket behind it, and a round single-LED module simply snaps into the socket from the back. The only soldering is the wires between the modules – no PCB, no glue.</p>'),
('<p>Rozložení zapíšete jako text: <code>88:88</code> pro hodiny, <code>88:88:88</code> pro hodiny se sekundami, <code>-88.8°</code> pro teploměr nebo <code>888.8[°C|%|hPa|ppm]</code> pro meteostanici s teplotou, vlhkostí, tlakem a CO₂. 3D náhled i čelní pohled s pořadím LED se přepočítají okamžitě a celý výpočet běží ve vašem prohlížeči.</p>',
 '<p>You type the layout as text: <code>88:88</code> for a clock, <code>88:88:88</code> for a clock with seconds, <code>-88.8°</code> for a thermometer or <code>888.8[°C|%|hPa|ppm]</code> for a weather station with temperature, humidity, pressure and CO₂. The 3D preview and the front view with the LED order update instantly, and everything is computed in your browser.</p>'),
('<h3>Co se dá nastavit</h3>', '<h3>What you can adjust</h3>'),
('<li>Velikost číslic, tloušťka segmentů, mezery a sklon; styly segmentů hroty 45°, šikmé rohy, zaoblené, rovné a asymetrické LCD.</li>',
 '<li>Digit size, segment thickness, gaps and slant; segment styles 45° points, beveled, rounded, flat and asymmetric LCD.</li>'),
('<li>Dvojtečky, desetinné tečky, stupně a symboly jednotek (°C, %, hPa, ppm, cm, km/h, kWh…) svícené jednou LED přes masku v čele.</li>',
 '<li>Colons, decimal points, degree signs and unit symbols (°C, %, hPa, ppm, cm, km/h, kWh…) lit by a single LED through a mask in the front.</li>'),
('<li>Lůžko modulu WS2812B, hloubka pouzdra, sloupky se šrouby M3, zadní krabička s otvorem pro kabel a otvory na zavěšení.</li>',
 '<li>The WS2812B module socket, case depth, posts with M3 screws, and a back box with a cable hole and keyholes for hanging.</li>'),
('<li>Difuzory z bílého nebo průsvitného filamentu – samostatně, nebo s AMS vytištěné rovnou v pouzdře.</li>',
 '<li>Diffusers made of white or translucent filament – printed separately, or with an AMS right inside the case.</li>'),
('<li>Velké displeje se samy rozdělí na díly podle tiskové plochy; díly drží rybinové zámky a šrouby a mezi nimi zůstanou průchody pro vodiče.</li>',
 '<li>Large displays are split into pieces to fit your print bed; dovetails and screws hold the pieces together, with passages for the wires between them.</li>'),
('<h3>Co si stáhnete</h3>', '<h3>What you download</h3>'),
('<p>STL pouzdra, difuzorů a krabičky, 3MF s díly připravenými pro vícebarevný tisk (Bambu Studio, OrcaSlicer, PrusaSlicer), hlavičkový soubor s mapou LED pro Arduino, ESP8266 nebo ESP32 (FastLED, Adafruit NeoPixel) a parametry v JSON, které jde později znovu načíst.</p>',
 '<p>STL files of the case, diffusers and back box, a 3MF with the parts ready for multi-color printing (Bambu Studio, OrcaSlicer, PrusaSlicer), a header file with the LED map for Arduino, ESP8266 or ESP32 (FastLED, Adafruit NeoPixel), and the parameters as JSON that you can load again later.</p>'),

# ---------- časté otázky ----------
('<h2>Časté otázky</h2>', '<h2>Frequently asked questions</h2>'),
('<summary>Jaké LED moduly potřebuji?</summary>', '<summary>Which LED modules do I need?</summary>'),
('<p>Kulaté destičky ⌀ 10 mm s jednou LED WS2812B (bývají označené „WS2812B with heatsink 10 × 3 mm“). Na každý segment, tečku i symbol připadá jeden modul. Průměr lůžka i tloušťku destičky upravíte v sekci Lůžko modulu WS2812B.</p>',
 '<p>Round ⌀ 10 mm boards with a single WS2812B LED (often sold as “WS2812B with heatsink 10 × 3 mm”). You need one module for every segment, dot and symbol. The socket diameter and the board thickness can be adjusted in the WS2812B module socket section.</p>'),
('<summary>Jaký zdroj stačí?</summary>', '<summary>What power supply do I need?</summary>'),
('<p>Jedna LED při plném bílém jasu odebere až 60 mA při 5 V. Hodiny 88:88 mají 30 LED, tedy nejvýš 1,8 A. Obvykle svítí jen část segmentů jednou barvou, takže stačí zdroj 5 V / 2 A. Odběr pro vaše rozložení ukáže přehled Rozměry a díly.</p>',
 '<p>One LED draws up to 60 mA at 5 V at full white brightness. An 88:88 clock has 30 LEDs, so at most 1.8 A. Usually only some of the segments are lit and in a single color, so a 5 V / 2 A supply is enough. The Dimensions and parts overview shows the current for your layout.</p>'),
('<summary>Jak pouzdro vytisknout?</summary>', '<summary>How do I print the case?</summary>'),
('<p>Pouzdro čelem dolů bez podpěr, krabičku zadní deskou dolů – čelo pak má povrch tiskové podložky. Difuzory jsou 1 mm bílého nebo průsvitného PLA či PETG. S AMS nastavte vůli difuzoru 0 a v 3MF jim přiřaďte jiný filament: vytisknou se rovnou v pouzdře a písmo symbolů může být souvislé.</p>',
 '<p>The case face down without supports, the back box with its back plate down – the front then gets the surface of the build plate. The diffusers are 1 mm of white or translucent PLA or PETG. With an AMS, set the diffuser clearance to 0 and assign them a different filament in the 3MF: they print right inside the case and the symbol font can be continuous.</p>'),
('<summary>Co když se displej nevejde na tiskárnu?</summary>', '<summary>What if the display does not fit on my printer?</summary>'),
('<p>Zadejte velikost tiskové plochy (výchozí 256 × 256 mm odpovídá Bambu Lab X1 a P1). Větší pouzdro se rozdělí na díly tak, aby řezy nevedly přes segmenty. Díly se spojí rybinovými zámky a šrouby M3 a ve spojových stěnách zůstanou výřezy pro vodiče.</p>',
 '<p>Enter the size of your print bed (the default 256 × 256 mm matches the Bambu Lab X1 and P1). A larger case is split into pieces so that no cut crosses a segment. The pieces are joined with dovetails and M3 screws, and the joint walls have notches for the wires.</p>'),
('<summary>Jak displej naprogramovat?</summary>', '<summary>How do I program the display?</summary>'),
('<p>LED jsou zapojené do jednoho řetězu. Mapa LED (<code>SEG_LED</code>, <code>DOT_LED</code>, <code>SYMBOL_LED</code>) říká, kolikátá LED v řetězu je který segment, takže firmware jen rozsvítí příslušné indexy. Pořadí segmentů v řetězu změníte v sekci Zapojení a kvalita.</p>',
 '<p>The LEDs are wired in a single chain. The LED map (<code>SEG_LED</code>, <code>DOT_LED</code>, <code>SYMBOL_LED</code>) tells you which LED in the chain is which segment, so the firmware simply lights the corresponding indices. You can change the order of the segments in the chain in the Wiring and quality section.</p>'),
('<summary>Je generátor zdarma?</summary>', '<summary>Is the generator free?</summary>'),
('<p>Ano. Výpočet běží celý ve vašem prohlížeči a model se nikam neodesílá. Generátor je svobodný software: <a href="https://github.com/mbrada/segmentovka" target="_blank" rel="noopener">zdrojový kód je na GitHubu</a> pod licencí GNU AGPL-3.0. Můžete ho upravit i provozovat jinde, upravenou verzi ale musíte zveřejnit pod stejnou licencí.</p>',
 '<p>Yes. Everything is computed in your browser and the model is not sent anywhere. The generator is free software: <a href="https://github.com/mbrada/segmentovka" target="_blank" rel="noopener">the source code is on GitHub</a> under the GNU AGPL-3.0 license. You may modify it and run it elsewhere, but you have to publish a modified version under the same license.</p>'),
('<summary>Smím vytištěná pouzdra prodávat?</summary>', '<summary>May I sell the printed cases?</summary>'),
('<p>Ne. Pro sebe je tiskněte a upravujte, jak chcete. Tvar pouzdra ale vychází z modelu <a href="https://www.printables.com/model/325415-7-segment-led-clock" target="_blank" rel="noopener">7 segment LED clock</a> od AWSW, jehož licence <a href="https://creativecommons.org/licenses/by-nc/4.0/deed.cs" target="_blank" rel="noopener">CC BY-NC 4.0</a> komerční použití nedovoluje.</p>',
 '<p>No. Print and modify them for yourself as you like. The shape of the case, however, is based on the <a href="https://www.printables.com/model/325415-7-segment-led-clock" target="_blank" rel="noopener">7 segment LED clock</a> model by AWSW, whose <a href="https://creativecommons.org/licenses/by-nc/4.0/deed.en" target="_blank" rel="noopener">CC BY-NC 4.0</a> license does not allow commercial use.</p>'),

# ---------- patička ----------
('<p>© 2026 <a href="https://miloslavbrada.cz/" target="_blank" rel="noopener">Miloslav Brada</a> · svobodný software pod licencí <a href="https://www.gnu.org/licenses/agpl-3.0.html" target="_blank" rel="noopener">GNU AGPL-3.0</a>, bez jakékoli záruky · <a href="https://github.com/mbrada/segmentovka" target="_blank" rel="noopener">zdrojový kód na GitHubu</a></p>',
 '<p>© 2026 <a href="https://miloslavbrada.cz/" target="_blank" rel="noopener">Miloslav Brada</a> · free software under the <a href="https://www.gnu.org/licenses/agpl-3.0.html" target="_blank" rel="noopener">GNU AGPL-3.0</a> license, without any warranty · <a href="https://github.com/mbrada/segmentovka" target="_blank" rel="noopener">source code on GitHub</a></p>'),
('<p>Tvar pouzdra vychází z modelu <a href="https://www.printables.com/model/325415-7-segment-led-clock" target="_blank" rel="noopener">7 segment LED clock</a> od AWSW (<a href="https://creativecommons.org/licenses/by-nc/4.0/deed.cs" target="_blank" rel="noopener">CC BY-NC 4.0</a>), upraveno.</p>',
 '<p>The case shape is based on the <a href="https://www.printables.com/model/325415-7-segment-led-clock" target="_blank" rel="noopener">7 segment LED clock</a> model by AWSW (<a href="https://creativecommons.org/licenses/by-nc/4.0/deed.en" target="_blank" rel="noopener">CC BY-NC 4.0</a>), modified.</p>'),

# ---------- dialog kóty ----------
('id="dim-name">Kóta<', 'id="dim-name">Dimension<'),
('id="dim-cancel">Zrušit<', 'id="dim-cancel">Cancel<'),
('class="btn primary">Použít<', 'class="btn primary">Apply<'),
],
}
