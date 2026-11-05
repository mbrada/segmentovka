# Segmentovka

Pouzdro pro 7segmentový displej z modulů WS2812B, které se zezadu jen zacvaknou do lůžka.
Vychází z pouzdra hodin 88:88 z modelu
[7 segment LED clock](https://www.printables.com/model/325415-7-segment-led-clock) od AWSW.
Původní soubor modelu (`Case.3mf`) v repozitáři není, stáhnete ho z Printables
(licence CC BY-NC 4.0).

- `generator/` – webový generátor pouzdra s vlastním rozložením, běží na https://segmentovka.miloslavbrada.cz
  (anglicky https://segmentovka.miloslavbrada.cz/en/, podrobnosti v `generator/README.md`)

## Licence

- Generátor (vše v `generator/`, pokud není uvedeno jinak): © 2026 Miloslav Brada,
  [GNU AGPL-3.0-or-later](LICENSE). Kdo ho upraví a zveřejní, nebo upravenou verzi provozuje
  jako webovou službu, musí její zdrojový kód zpřístupnit pod stejnou licencí.
- Tvar pouzdra, ze kterého generátor vychází: model
  [7 segment LED clock](https://www.printables.com/model/325415-7-segment-led-clock) od AWSW,
  licence [CC BY-NC 4.0](https://creativecommons.org/licenses/by-nc/4.0/) – uveďte autora,
  nepoužívejte komerčně. Vytištěná pouzdra proto nejsou na prodej.
- `generator/manifold.js`, `generator/manifold.wasm`: [manifold-3d](https://github.com/elalish/manifold),
  Apache-2.0 (`generator/manifold-LICENSE.txt`).
- Písma Archivo a IBM Plex Mono se načítají z Google Fonts (SIL Open Font License),
  three.js z jsDelivr (MIT).
