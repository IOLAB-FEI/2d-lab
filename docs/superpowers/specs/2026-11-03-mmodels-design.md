# mmodels – online nástroj na tvorbu jednoduchých modelov mechanických systémov

Dátum: 2026-11-03 · Autor zadania: Jakub Matišák · Predloha: Matišák & Žáková, *Online Tool for Creating Simple Models of Mechanical Systems*, ICETA 2018, s. 355–359.

## 1. Zámer a prečo

Pôvodný nástroj (2018) dovoľoval nakresliť mechanický systém (telesá, pružiny, tlmiče, steny), no **diferenciálne rovnice zadával učiteľ ručne** a simulácia bežala vzdialene v OpenModelice cez JSON-RPC. Obrázok a rovnice tak neboli zviazané a každá zmena parametra znamenala čakanie na server.

Nová verzia má študenta naučiť, **ako rovnice súvisia so správaním systému**. Používateľ (študent aj učiteľ) systém **jednoducho nakreslí**, nástroj z obrázka **sám odvodí rovnice**, okamžite ich nasimuluje a zobrazí tri zosynchronizované pohľady:

1. **obrázok** – animovaný systém,
2. **rovnice** – odvodené z topológie, členy farebne zviazané s prvkami,
3. **správanie** – graf v čase s čiarou „tu som“.

## 2. Ciele, ne-ciele, anti-ciele

**Ciele (v1)**
- Kreslenie systému ťahaním z palety, spájanie prvkov cez porty s „magnetom“.
- Automatické odvodenie pohybových rovníc z nakresleného systému (symbolicky aj s číslami).
- Okamžitá simulácia v prehliadači; zmena parametra prepočíta celý priebeh.
- Prehrávanie ako vo video prehrávači: play/pauza, rýchlosť, posuvník, návrat späť.
- Graf: os času pokrýva celú simuláciu, prejdená časť plná, budúca **bledšia**, zvislá čiara „tu som“, klik/ťahanie v grafe posúva čas.
- Horizontálne aj vertikálne (s gravitáciou) systémy, 1D posuvný pohyb.
- Ukladanie bez servera: súbor JSON, zdieľateľný odkaz, automatické uloženie v prehliadači.
- Export do Modelica (MSL) – kompatibilita s pôvodným nástrojom a OpenModelicou.

**Ne-ciele (v1)**
- Žiadny backend, účty ani databáza. Žiadny Docker (stačí statická stránka).
- Rotačná doména, nelineárne prvky (Coulombovo trenie, kontakt), 2D/3D pohyb.
- Prenosové funkcie, póly, Bode, vlastné módy – plánované pre v2.

**Anti-ciele (čo by bolo zlyhanie, aj keby to „fungovalo“)**
- Rovnice, ktoré nezodpovedajú obrázku (ručne zadávané rovnice sú zakázané).
- Fyzika odvodená z pixelov (poloha v pixeloch ≠ fyzikálna veličina).
- Neintuitívne kreslenie, ktoré študenta odradí skôr, než sa dostane k rovniciam.

## 3. Obmedzenia

- **Vue 3 (Composition API) + TypeScript + Vite + Vuetify 3** (štandard tímu), stav cez **Pinia**.
- Výsledok je **statická stránka** (`vite build`), hostovateľná kdekoľvek.
- Kreslenie: **čisté SVG renderované Vue komponentmi**, interakcia cez **pointer events** (myš, dotyk, pero) – bez kresliacej knižnice.
- Rovnice: **KaTeX**. Graf: vlastný SVG komponent (potrebujeme plnú kontrolu nad „bledou budúcnosťou“ a kurzorom).
- Výpočtové jadro je **čistý TypeScript bez závislosti na Vue** (`src/core`), testované vo **Vitest**.
- UI v slovenčine (texty v jednom module, aby sa dalo neskôr preložiť) – *moje rozhodnutie*.

## 4. Rozhranie

Rozloženie (podľa odsúhlaseného náčrtu):

```
┌ panel nástrojov: názov · Návrh | Simulácia · undo/redo · uložiť/otvoriť/zdieľať/export ┐
├ paleta ┬──────────── plátno (SVG) ─────────────┬ vlastnosti vybraného prvku ┤
├────────┴──── rovnice (KaTeX, farebné členy) ───┴─────────────────────────────┤
├──────── graf (celá os času, čiara „tu som“) + prehrávač (play, posuvník, rýchlosť) ┤
```

**Režim Návrh** – telesá sú v nakreslenej (pokojovej) polohe, dá sa kresliť a upravovať.
**Režim Simulácia** – štruktúra je zamknutá, parametre sa dajú meniť naživo; telesá sa animujú. Ťahaním telesa pozdĺž osi sa nastaví jeho počiatočná výchylka `x₀` a čas sa vráti na 0 (*moje rozhodnutie podľa tvojho „ok“*).

**Interakcie editora**
- Paleta → plátno: `pointerdown` na položke, „duch“ pod kurzorom, pustenie nad plátnom vytvorí prvok (prepočet cez `getScreenCTM().inverse()`).
- Stena, teleso: položia sa na miesto pustenia (prichytenie na mriežku 10 px).
- Pružina, tlmič, pružina+tlmič: pustením medzi dve telesá/steny sa automaticky pripoja k dvom najbližším protiľahlým portom (magnet). Alternatívne: ťahanie z portu na port vytvorí spoj aktuálne zvoleného typu.
- Sila: pustením na teleso sa naň pripojí.
- Výber klikom → vlastnosti vpravo; Delete zmaže; Ctrl+Z / Ctrl+Y; posun telesa ťahaním (jeden krok histórie na celé ťahanie).
- Paralelné spoje medzi tou istou dvojicou sa kreslia posunuté vedľa seba.

**Zviazanie pohľadov**
- Výber prvku zvýrazní jeho členy v rovniciach.
- Prepínač rovníc: symbolicky (`k₁(x₂ − x₁)`) / s číslami (`0.1·(x₂ − x₁)`).
- Graf: polohy telies (farba = farba telesa), voliteľne rýchlosti; hodnoty v čase kurzora v legende.
- Prekrytie telies počas simulácie (lineárny model nepozná kolízie) sa zobrazí ako varovanie s časom prvého prekrytia.

## 5. Fyzikálny model

**Konvencie**
- Každé teleso je jeden stupeň voľnosti `xᵢ` = **posunutie voči nakreslenej polohe** v metroch.
- Nakreslený stav = **pokojový stav**: všetky pružiny sú v ňom nenapäté (pokojová dĺžka vypadne z rovníc).
- Horizontálne: `+x` doprava. Vertikálne: `+x` **nadol**, gravitácia pôsobí silou `+mᵢ·g` (g = 9.81 m/s²).
- Steny sú pevné (`x = 0`). Jednotky SI. Mierka zobrazenia: 200 px = 1 m (nastaviteľné).

**Prvky v1**

| Prvok | Parametre | Príspevok |
|---|---|---|
| Teleso | `m > 0`, `x₀`, `v₀`, trenie o podložku `b ≥ 0` | `M[i,i] += m`, `C[i,i] += b` |
| Stena | – | pevný uzol |
| Pružina | `k > 0` | `K` stamp medzi uzlami a, b |
| Tlmič | `d > 0` | `C` stamp medzi uzlami a, b |
| Pružina+tlmič | `k`, `d` | oboje |
| Sila | typ: konštantná / skok / sínus, amplitúda, čas začiatku, frekvencia | `F(t)` na uzol |

Stamp medzi a, b (koeficient c): `[a,a] += c, [b,b] += c, [a,b] −= c, [b,a] −= c`; riadky/stĺpce stien sa vypustia.
V tomto modeli spoje vždy spájajú dve telesá/steny, takže **nehmotné uzly nevznikajú** (sériové zapojenie bez telesa medzi nimi je mimo rozsahu v1).

**Stavový model**: `z = [x; ẋ]`, `ż = A z + B u`,
`A = [[0, I], [−M⁻¹K, −M⁻¹C]]`, `B = [[0], [M⁻¹]]`, `u` = vektor síl (vrátane gravitácie).

**Simulácia**: presná diskretizácia `Φ = e^{AΔt}`, `Γ = ∫₀^{Δt} e^{Aτ}dτ·B` (exponenciála rozšírenej matice `[[A,B],[0,0]]`, Padé + scaling&squaring). Vstup sa vzorkuje v strede kroku. Predvolené: trvanie 20 s, Δt = 0.01 s. Výpočet je rádovo milisekundy → pri zmene parametra sa prepočíta celý priebeh na hlavnom vlákne (Web Worker až pri potrebe, *moje rozhodnutie pre v1*).

**Rovnice** (z rovnakých príspevkov): pre každé teleso
`mᵢ·ẍᵢ = Σ kⱼ(x_druhý − xᵢ) + Σ dⱼ(ẋ_druhý − ẋᵢ) − bᵢ·ẋᵢ + mᵢ·g + Fᵢ(t)`; ak je druhý koniec stena, člen je `−kⱼ·xᵢ`.

**Validácia** (živá, zoznam upozornení):
- chyba: žiadne teleso; `m ≤ 0`, `k ≤ 0`, `d ≤ 0`, `b < 0`; spoj s rovnakými koncami.
- varovanie: teleso bez pružného spojenia so stenou (môže „odplávať“), prekrytie telies počas simulácie.

## 6. Ukladanie a exporty

- **Automatické uloženie** do `localStorage`.
- **Súbor**: export/import `.mmodel.json` (verzovaná schéma `version: 1`).
- **Zdieľanie**: model skomprimovaný do časti URL za `#` (lz-string) – bez servera.
- **Modelica**: vygenerovaný `.mo` s komponentmi `Modelica.Mechanics.Translational` (`Mass`, `Spring`, `Damper`, `Fixed`, `Sources.Force`, `ConstantForce` pre gravitáciu) a `connect(...)`; číselné parametre sú validované (žiadna injekcia kódu).

## 7. Architektúra

```
src/
  core/            čistý TS – model.ts, linalg.ts, assemble.ts, simulate.ts,
                   equations.ts, validate.ts, modelica.ts, examples.ts, *.test.ts
  stores/          Pinia – model (+ história undo/redo), ui (výber, režim, čas)
  composables/     useSimulation, usePlayback, useCanvasInteraction
  components/      AppToolbar, PalettePanel, EditorCanvas, shapes/*, PropertiesPanel,
                   EquationsPanel, TimeGraph, PlaybackBar, ValidationList
```

## 8. Testovanie

- Vitest (jadro): netlmený oscilátor vs. `x₀·cos(ωt)`; podkritické tlmenie vs. analytické riešenie; ustálená výchylka pri skoku `F/k`; zachovanie energie pri dvoch telesách bez tlmenia; generované rovnice; Modelica export obsahuje správne `connect`.
- Ručné overenie v prehliadači (Playwright e2e až vo v2).
- Voliteľne: overenie `.mo` exportu v OpenModelice.

## 9. Fázy

- **v1 (teraz)**: všetko z bodu 2 „Ciele“.
- **v2**: prenosová funkcia, póly, Bode, vlastné frekvencie a animácia módov; Coulombovo trenie a kontakt; zamknuté „zadania“ učiteľa (zoznam meniteľných parametrov s rozsahmi); export A,B,C,D (MATLAB/Scilab/Python); Playwright testy.
- **v3**: rotačná doména, backend (zdieľanie, účty), Docker.

## 10. Ponechané na implementátorovi

Presný vzhľad tvarov, farby prvkov, rozloženie panelov v rámci náčrtu, klávesové skratky navyše, štruktúra testov.

## 11. Rozhodnutia, ktoré som urobil sám (na kontrolu)

1. Spoje vždy medzi dvoma telesami/stenami – žiadne nehmotné uzly vo v1.
2. Vertikálne `+x` nadol, gravitácia ako konštantná sila.
3. Simulácia na hlavnom vlákne (bez Web Workera) vo v1.
4. Vlastný SVG graf namiesto uPlot.
5. Ťahanie telesa v režime Simulácia nastavuje `x₀`.
6. UI v slovenčine.
7. Predvolené trvanie 20 s, Δt = 0.01 s, mierka 200 px/m.
8. Prepnutie Vodorovne/Zvislo (na plátne) otočí kresbu (ľavá strana → horná) a vo zvislom systéme zapne gravitáciu.
9. Desktop: aplikácia vyplní výšku okna bez posúvania stránky; pod 960 px sa panely skladajú pod seba a stránka sa posúva.
