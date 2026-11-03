<img src="public/favicon.svg" alt="" width="64" height="64" />

# MechSim

Online nástroj na tvorbu jednoduchých modelov mechanických systémov. Študent nakreslí sústavu telies, pružín, tlmičov a stien, nástroj z obrázka sám odvodí pohybové rovnice, okamžite ich odsimuluje v prehliadači a ukáže, ako rovnice súvisia so správaním systému.

Nadväzuje na nástroj z článku Matišák, J., Žáková, K.: *Online Tool for Creating Simple Models of Mechanical Systems*, ICETA 2018, [doi:10.1109/ICETA.2018.8572249](https://doi.org/10.1109/ICETA.2018.8572249). Na rozdiel od pôvodného riešenia sa rovnice nezadávajú ručne a nepotrebuje server.

## Čo vie

- **Kreslenie** – prvky sa ťahajú z palety, spájajú z krúžku na krúžok (s magnetom), pružina alebo tlmič pustený medzi dve telesá sa pripojí sám. Undo/redo, zoom, posun plátna, ovládanie myšou aj dotykom.
- **Vodorovné a zvislé systémy** – prepínač na plátne otočí celú kresbu; vo zvislom systéme sa zapne gravitácia.
- **Rovnice** – odvodené z nakresleného systému, symbolicky alebo s číslami. Každý člen má farbu svojho prvku a vybraný prvok sa v rovniciach zvýrazní.
- **Simulácia** – presná diskretizácia lineárneho modelu (maticová exponenciála), prepočet pri každej zmene parametra.
- **Prehrávanie** – play/pauza, krokovanie, rýchlosť, posuvník. Graf pokrýva celú simuláciu, prejdená časť je plná, budúca bledá a čiara „tu som“ ukazuje aktuálny čas; kliknutím do grafu sa dá skočiť v čase. V režime Simulácia sa ťahaním telesa nastaví jeho počiatočná výchylka.
- **Kontroly** – upozorní na neplatné parametre, teleso bez pružiny ku stene a na zrážku telies počas pohybu.
- **Ukladanie bez servera** – automaticky v prehliadači, súbor `.mechsim.json`, zdieľací odkaz (model je zakódovaný v adrese) a export do Modelica (`.mo`, knižnica `Modelica.Mechanics.Translational`).
- **Ukážky** – dve telesá medzi stenami (s tlmením aj bez), teleso na vozíku, dve telesá spojené pružinou, tlmený harmonický oscilátor, dve viazané telesá (pružina–tlmič) a dva vozíky so silou.

## Spustenie

Potrebný je Node.js 20 alebo novší.

```bash
npm install
```

```bash
npm run dev
```

Aplikácia beží na <http://localhost:5173>.

| Príkaz | Čo robí |
|---|---|
| `npm run dev` | vývojový server s automatickým obnovovaním |
| `npm test` | testy výpočtového jadra (Vitest) |
| `npm run build` | typová kontrola a produkčný build do `dist/` |
| `npm run preview` | lokálne spustí hotový build |

## Nasadenie

Výsledok buildu je statická stránka. Obsah priečinka `dist/` stačí nahrať na ľubovoľný webový server alebo hosting (GitHub Pages, Azure Static Web Apps, Nginx…). Cesty sú relatívne (`base: './'`), takže stránka funguje aj v podpriečinku.

## Ako to funguje

Jediným zdrojom pravdy je dátový model v [src/core/model.ts](src/core/model.ts). Fyzika (hmotnosti, tuhosti, tlmenia, topológia) je oddelená od kresby v pixeloch.

- Poloha telesa `xᵢ` je posunutie voči nakreslenej polohe; nakreslené pružiny sú v pokoji. Vo vodorovnom systéme je kladný smer doprava, vo zvislom nadol (gravitácia pôsobí silou `m·g`).
- Z prvkov sa poskladajú matice `M`, `C`, `K` a sústava `M ẍ + C ẋ + K x = F(t)` sa prepíše do stavového tvaru.
- Simulácia používa presnú diskretizáciu s tvarovačom nultého rádu: `exp([[A, B], [0, 0]]·dt)` cez Padého aproximáciu so škálovaním a umocňovaním.
- Rovnice v LaTeX-u (KaTeX) aj export do Modelica sa generujú z tých istých matíc, takže vždy zodpovedajú obrázku.

## Štruktúra projektu

```
src/
  core/          výpočtové jadro bez závislosti na Vue
    model.ts       typy a pomocné funkcie modelu
    assemble.ts    zostavenie matíc M, C, K a stavového tvaru
    linalg.ts      lineárna algebra a maticová exponenciála
    simulate.ts    simulácia
    equations.ts   pohybové rovnice v LaTeX-u
    validate.ts    kontrola modelu
    geometry.ts    geometria kresby, otáčanie osi, zrážky
    modelica.ts    export do Modelica
    examples.ts    ukážkové systémy
    core.test.ts   testy
  stores/        stav aplikácie (Pinia), undo/redo, ukladanie
  composables/   simulácia a prehrávanie pre komponenty
  components/    plátno, paleta, vlastnosti, rovnice, graf, prehrávač, lišta
public/          favicon, ikony a manifest
docs/            design dokument a plán prvej verzie
```

Technológie: Vue 3, TypeScript, Vite, Vuetify 3, Pinia, KaTeX, lz-string, Vitest.

## Dokumentácia

- [Design dokument](docs/superpowers/specs/2026-11-03-mmodels-design.md) – zámer, ciele, rozhranie, fyzika a plán ďalších verzií.
- [Plán prvej verzie](docs/superpowers/plans/2026-11-03-mmodels-v1.md).
