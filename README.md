# Plotter — Prism-style publication figure builder

A 100% client-side line / bar / violin plot maker with replicate statistics,
significance brackets, and vector + raster export. No backend, no env vars —
deploys to Vercel as static files.

> **A note on the stack.** The brief describes a "Next.js + Plotly.js + Jest"
> app, but the repository's existing UI is a **dc-runtime** single-file React
> app (`Plotter.dc.html` + the prebuilt `support.js`), and the task is to wire
> the engine to *that* UI. So the engine is authored as a real, strict,
> unit-tested **TypeScript** module under `src/`, bundled to a committed
> `engine.js`, and loaded by the dc-runtime UI. Plots are rendered as inline
> **SVG** rather than via Plotly — which actually serves the "editable text in
> Illustrator/Inkscape" requirement better, since we emit clean `<text>`
> elements directly. SheetJS is used for spreadsheet parsing as specified.

## Layout

```
Plotter.dc.html        the UI (dc-runtime template + inline component logic)
support.js             dc-runtime (provided; loads React from a CDN)
engine.js              GENERATED bundle of src/*.ts (loaded via <helmet>)
src/
  types.ts             shared types
  stats.ts             statistics engine (pure, tested)
  parse.ts             SheetJS parsing + LONG/WIDE detection (pure core, tested)
  plot.ts              SVG scene builder + bracket auto-stacking (pure, tested)
  index.ts             engine entry: state→spec→scene, React glue, export IO
  *.test.ts            Jest suites (71 tests)
scripts/
  build.mjs            esbuild bundle src/index.ts → engine.js
  gen-templates.mjs    regenerate /public sample templates from the engine
  _component.js        editable source of the inline dc component logic
  inline-component.mjs splice _component.js into Plotter.dc.html
public/
  plotter-template-long.csv
  plotter-template-wide.csv
```

## Develop

```bash
npm install
npm test          # 71 Jest tests (stats + parse + plot)
npm run typecheck # strict tsc
npm run build     # rebuild engine.js + /public templates
npm run inline    # re-splice scripts/_component.js into Plotter.dc.html
```

Open `Plotter.dc.html` over HTTP (e.g. `npx serve .`) — `file://` won't load the
sibling `engine.js` under some browsers' CORS rules.

## Statistics module (`src/stats.ts`)

Pure functions, no DOM. Distributions are implemented directly (regularized
incomplete beta → Student-t / Fisher-F tails; erf → normal) so the static build
needs no runtime dependency; they match jStat/R to plotting precision (verified
in `stats.test.ts`). Swapping in jStat would be a drop-in replacement for
`studentTTwoTailedP` / `fUpperTailP` / `normalCdf`.

- **Descriptive** — `describe()` returns `n`, mean, sample SD (n-1), SEM, and
  the 95% CI half-width `t(0.975, n-1)·SEM`. Blank/non-numeric cells are dropped
  and `n` is recomputed per point.
- **t-tests** — `unpairedT` (pooled), `welchT` (unequal variance, fractional
  df), `pairedT`; each returns `{ t, df, p }` (two-tailed).
- **Mann–Whitney U** — exact enumeration for small samples without ties; normal
  approximation with continuity + tie correction otherwise.
- **One-way ANOVA** — `oneWayANOVA` → `{ F, df1, df2, p }` for an overall p.
- **Multiple comparisons** — `adjustPValues` does Holm–Šídák (default),
  Bonferroni, or none. `pToSymbol` maps to `* / ** / *** / **** / ns`.

### The post-hoc seam

All comparison work goes through **one** interface:

```ts
runComparisons(groups: GroupValues[], opts: ComparisonOptions): Comparison[]
```

v1 ships `LocalPostHocProvider` (corrected pairwise tests, fully in-browser).
The rendering code only ever calls `runComparisons` and reads back
`{ groupA, groupB, pAdjusted, symbol, … }` — it never touches a specific test.
A future `POST /api/stats` (Python scipy/statsmodels for Tukey, Dunnett,
two-way ANOVA) implements the same `PostHocProvider` interface and is installed
with `setPostHocProvider(...)` **without touching any rendering code**. The
endpoint is intentionally *not* built here — only the clean seam.

## Parsing (`src/parse.ts`)

SheetJS reads the first sheet to a `string[][]` grid; everything after that is
pure and tested. **LONG** (`Group, X, Value`) and **WIDE** (`X` + per-group
replicate columns like `Drug A_1, Drug A_2, …`) are auto-detected, with a manual
Auto/Long/Wide toggle in the UI. Non-numeric values and ragged rows raise clear,
located errors; blanks are ignored.

## Rendering (`src/plot.ts`)

A React-free scene tree → converted to React elements for live display, and
serialized to a standalone SVG string for export (the *same* tree, so what you
see is what you export). Per-series colour/marker/line-style, Y range, log scale,
legend position, and title are all honoured.

### Theme presets & fonts

`buildScene` takes an optional `theme` (key into `THEMES`) and `fontFamily`
override:

- **Prism** (default) — white background, only left + bottom axis lines
  (~1.5px), outward 6px ticks, no box/mirror.
- **Nature (boxed)** — black ink, full 4-sided axis box, thinner (1px) lines,
  inward 4px ticks.

Either theme's default font (Helvetica/Arial vs. Arial) can be overridden
independently via `fontFamily` — Helvetica, Arial, Times New Roman, Georgia, or
Courier New — exposed in the UI as a "Plot style" toggle + "Font" dropdown.
Gridline colour and marker/line weights also come from the active theme.

- **Line** — numeric or categorical X (numeric supports log); markers + line +
  capped error bars in the series colour.
- **Bar** — one bar per group, capped error bars, optional jittered points.
- **Violin** — KDE with `spanmode: hard` (truncated to the data range),
  box / mean±SD / none inner, optional jittered points; warns when any group has
  n < 10.
- **Significance brackets** — horizontal brackets between categories with
  downward end-caps and centred labels, **auto-stacked** by level
  (`assignBracketLevels`) so they never overlap; per-X markers for Line
  "compare at each X". Configurable height/gap/cap. Exports cleanly to SVG/PNG.

## Export

- **SVG** — vector, editable text, opens in Illustrator/Inkscape.
- **PNG** — honours width×height (mm → px) and DPI (150/300/600) via a
  `dpi/96` scale factor. Filenames include the plot title.

## Python / matplotlib companion (`python/prism_style.py`)

For users who build manuscript figures in Python, `python/prism_style.py`
reproduces the **same Prism visual language** as the web engine — white
background, no grid, only left+bottom spines, black outward ticks, bold
sans-serif labels, and the identical Wong colour-blind-safe `PALETTE` (the
"Treated"/second-group accent is `#0072B2`, the same blue the app uses).

```bash
pip install -r python/requirements.txt
python python/prism_style.py        # regenerates the demo panels
```

It defines global manuscript `rcParams` (Arial→DejaVu Sans, font 9 / bold axis
labels 11, axis line ~1.6, tick width 1.4 / length 4, `savefig.dpi=600`, and
`pdf.fonttype=42` + `svg.fonttype='none'` so exported text stays editable in
Illustrator/Inkscape), a reusable `prism_style(ax)` helper, and three plotters
that mirror the app's chart types:

- `boxplot_with_points` — light-grey boxes, black median/whiskers/caps, jittered
  black dots (outliers hidden), optional significance bars (`***`).
- `barplot_with_points` — grey bars, mean ± SEM/SD capped error bars, jittered
  replicate dots, manual y-range, rotated well-ID ticks.
- `lineplot_with_error` — markers + lines + capped error bars for 1–2 groups
  (black + dark-blue accent), frameless legend, in-plot annotations.

Plus `add_panel_label(ax, "(C)")` for bold corner labels and `save_figure()`
which writes PDF + SVG + PNG at 600 dpi in one call. No seaborn.

## Deploy (Vercel)

`vercel.json` builds with `npm run build` and serves the repo root as static
files (no serverless functions, no env vars); `/` rewrites to `Plotter.dc.html`.
`engine.js` and the templates are also committed, so a zero-build static host
works too.

## Acceptance criteria → where

| Criterion | Implementation |
|---|---|
| Typing **or** uploading produces the same plot | both feed the same `cells` grid → `specFromState` |
| SD/SEM/CI updates error bars live | `errorValue()`; reselect re-renders |
| Series colour updates line, markers, error bars | single `color` drives all three in `plot.ts` |
| SVG opens with editable text in Illustrator | `serializeSvg` emits real `<text>` |
| Builds/deploys on Vercel, no functions/env | static files + `vercel.json` |
| Jest tests for the stats module | `src/stats.test.ts` (+ parse/plot suites) |
