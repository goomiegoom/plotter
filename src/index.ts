/**
 * Engine bundle entry point.
 *
 * esbuild bundles this file (and everything it imports) into `engine.js`, an
 * IIFE that publishes `window.PlotterEngine`. The dc-runtime UI
 * (`Plotter.dc.html`) loads `engine.js` plus SheetJS (from a CDN) via its
 * <helmet> and drives everything through this one global — keeping the heavy
 * logic out of the inline component script and fully unit-tested under `src/`.
 */

import * as stats from "./stats";
import * as parse from "./parse";
import * as plot from "./plot";
import type { Dataset, ErrorType, MarkerShape, LineStyle } from "./types";
import type {
  PlotSpec,
  RenderSeries,
  SceneBracket,
  Scene,
  El,
} from "./plot";
import type { Comparison, ComparisonOptions, GroupValues } from "./stats";

// ---------------------------------------------------------------------------
// Spec assembly: dc-runtime state -> PlotSpec
// ---------------------------------------------------------------------------

export interface UiState {
  plotType: "line" | "bar" | "violin";
  errorType: ErrorType;
  xAxisType: "numeric" | "categorical";
  groups: Array<{ name: string; color: string; marker: MarkerShape; line: LineStyle }>;
  xLabels: string[];
  cells: string[][][];
  yAuto: boolean;
  yMin: string;
  yMax: string;
  yLog: boolean;
  xLog: boolean;
  gridlines: boolean;
  plotTitle: string;
  legendPos: "top-right" | "outside-right" | "none";
  barWidth: number;
  barOutline: boolean;
  violinInner: "box" | "meansd" | "none";
  showPoints: boolean;
  xTitle: string;
  yTitle: string;
  // stats
  showSig: boolean;
  testFamily: "parametric" | "nonparam";
  compMode: "allpairs" | "control" | "manual";
  controlGroup: number;
  correction: "holm" | "bonferroni" | "none";
  sigDisplay: "asterisks" | "pvalue" | "ns";
  compareAtEachX: boolean;
  manualPairs?: Array<[number, number]>;
  // appearance
  theme?: string;
  fontFamily?: string;
}

/** Aggregate all of a group's numeric values across every X column. */
function aggregate(cells: string[][][], gi: number, errorType: ErrorType): plot.GroupAgg {
  const values: number[] = [];
  for (const col of cells[gi] ?? []) values.push(...stats.cleanValues(col));
  const s = stats.describe(values);
  return { mean: s.mean, err: stats.errorValue(s, errorType), sd: s.sd, n: s.n, values: s.values };
}

function buildSeries(S: UiState): RenderSeries[] {
  return S.groups.map((g, gi) => {
    const points: plot.LinePoint[] = S.xLabels.map((lab, xi) => {
      const st = stats.describe(S.cells[gi]?.[xi] ?? []);
      return {
        xLabel: lab,
        xNum: Number(lab),
        mean: st.mean,
        err: stats.errorValue(st, S.errorType),
        n: st.n,
        values: st.values,
      };
    });
    return {
      name: g.name,
      color: g.color,
      marker: g.marker,
      line: g.line,
      points,
      agg: aggregate(S.cells, gi, S.errorType),
    };
  });
}

/** Build the GroupValues the comparison engine consumes (one sample/group). */
function groupValues(S: UiState, xIndex?: number): GroupValues[] {
  return S.groups.map((g, gi) => {
    let values: number[];
    if (xIndex == null) {
      values = [];
      for (const col of S.cells[gi] ?? []) values.push(...stats.cleanValues(col));
    } else {
      values = stats.cleanValues(S.cells[gi]?.[xIndex] ?? []);
    }
    return { index: gi, name: g.name, values };
  });
}

function comparisonOptions(S: UiState): ComparisonOptions {
  return {
    family: S.testFamily,
    parametric: "welch",
    mode: S.compMode,
    controlIndex: S.controlGroup,
    pairs: S.manualPairs,
    correction: S.correction,
    display: S.sigDisplay,
  };
}

function bracketLabel(c: Comparison, display: UiState["sigDisplay"]): { label: string; isNs: boolean } {
  const isNs = c.symbol === "ns";
  if (display === "pvalue") return { label: stats.formatP(c.pAdjusted), isNs };
  if (display === "ns") return { label: c.symbol, isNs };
  // asterisks: hide ns unless it is the only signal? GraphPad shows ns too.
  return { label: c.symbol, isNs };
}

/** Compute the significance brackets for the current state. */
export function computeBrackets(S: UiState): { brackets: SceneBracket[]; comparisons: Comparison[]; warnings: string[] } {
  const warnings: string[] = [];
  if (!S.showSig || S.groups.length < 2) return { brackets: [], comparisons: [], warnings };

  // Violin small-n advisory.
  if (S.plotType === "violin") {
    const small = S.groups.some((_, gi) => aggregate(S.cells, gi, S.errorType).n < 10);
    if (small) warnings.push("Some groups have n < 10 — a bar chart with individual points is usually clearer than a violin.");
  }

  if (S.plotType === "line" && S.compareAtEachX) {
    const all: Comparison[] = [];
    const brackets: SceneBracket[] = [];
    S.xLabels.forEach((_, xi) => {
      const cs = stats.runComparisons(groupValues(S, xi), comparisonOptions(S));
      cs.forEach((c) => {
        all.push({ ...c, xIndex: xi });
        const { label, isNs } = bracketLabel(c, S.sigDisplay);
        brackets.push({ aIndex: c.groupA, bIndex: c.groupB, label, isNs, xIndex: xi });
      });
    });
    return { brackets, comparisons: all, warnings };
  }

  const comparisons = stats.runComparisons(groupValues(S), comparisonOptions(S));
  const brackets: SceneBracket[] = comparisons.map((c) => {
    const { label, isNs } = bracketLabel(c, S.sigDisplay);
    return { aIndex: c.groupA, bIndex: c.groupB, label, isNs };
  });
  return { brackets, comparisons, warnings };
}

/** Assemble the full PlotSpec from dc-runtime UI state. */
export function specFromState(S: UiState): { spec: PlotSpec; comparisons: Comparison[]; warnings: string[] } {
  const { brackets, comparisons, warnings } = computeBrackets(S);
  const spec: PlotSpec = {
    plotType: S.plotType,
    errorType: S.errorType,
    xAxisType: S.plotType === "line" ? S.xAxisType : "categorical",
    series: buildSeries(S),
    xLabels: S.xLabels,
    xTitle: S.xTitle,
    yTitle: S.yTitle,
    plotTitle: S.plotTitle,
    yAuto: S.yAuto,
    yMin: parseFloat(S.yMin) || 0,
    yMax: parseFloat(S.yMax) || 0,
    yLog: S.plotType === "line" && S.yLog,
    xLog: S.plotType === "line" && S.xAxisType === "numeric" && S.xLog,
    gridlines: S.gridlines,
    legendPos: S.legendPos,
    barWidth: S.barWidth,
    barOutline: S.barOutline,
    violinInner: S.violinInner,
    showPoints: S.showPoints,
    showSig: S.showSig,
    compareAtEachX: S.plotType === "line" && S.compareAtEachX,
    sigDisplay: S.sigDisplay,
    brackets,
    theme: S.theme,
    fontFamily: S.fontFamily,
  };
  return { spec, comparisons, warnings };
}

// ---------------------------------------------------------------------------
// Scene -> React elements (for live display in the dc-runtime UI)
// ---------------------------------------------------------------------------

const ATTR_RENAME: Record<string, string> = {
  "font-size": "fontSize",
  "font-weight": "fontWeight",
  "font-style": "fontStyle",
  "font-family": "fontFamily",
  "text-anchor": "textAnchor",
  "stroke-width": "strokeWidth",
  "stroke-dasharray": "strokeDasharray",
  "stroke-linejoin": "strokeLinejoin",
  "fill-opacity": "fillOpacity",
};

/**
 * Optional per-node decorator: return extra React props (e.g. onClick, style)
 * to merge onto the converted element, or null. Lets the UI make legend
 * entries clickable and size the root <svg> responsively without the engine
 * needing to know about React event handling.
 */
export type Decorator = (node: El) => Record<string, unknown> | null | undefined;

/**
 * Convert a scene node into a React element using the host React. SVG presentation
 * attributes are passed straight through (React accepts hyphenated SVG attrs),
 * but we also alias the camelCase forms React prefers to avoid warnings.
 */
export function toReact(
  React: any,
  node: El | string,
  key?: number,
  decorate?: Decorator
): any {
  if (typeof node === "string") return node;
  const props: Record<string, unknown> = { key };
  for (const [k, v] of Object.entries(node.attrs)) {
    if (k === "key") continue;
    const name = ATTR_RENAME[k] ?? k;
    props[name] = v;
  }
  const extra = decorate ? decorate(node) : null;
  if (extra) Object.assign(props, extra);
  const children = node.children.map((c, i) => toReact(React, c, i, decorate));
  return React.createElement(node.tag, props, ...children);
}

// ---------------------------------------------------------------------------
// Browser-only IO: file read, template download, SVG / PNG export
// ---------------------------------------------------------------------------

function getXLSX(): parse.XlsxLike {
  const X = (globalThis as any).XLSX;
  if (!X) throw new parse.ParseError("Spreadsheet library not loaded yet — please retry in a moment.");
  return X as parse.XlsxLike;
}

/** Read + parse an uploaded File into a Dataset-shaped result. */
export async function parseFile(file: File, shape?: parse.Shape): Promise<parse.ParsedData> {
  const buf = await file.arrayBuffer();
  if (/\.csv$/i.test(file.name)) {
    const text = new TextDecoder().decode(buf);
    return parse.parseRows(csvToRows(text), shape);
  }
  return parse.parseWorkbook(buf, getXLSX(), shape);
}

function csvToRows(text: string): string[][] {
  // Small CSV reader handling quotes.
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else inQuotes = false;
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
    else if (c === "\r") { /* skip */ }
    else field += c;
  }
  if (field !== "" || row.length) { row.push(field); rows.push(row); }
  return rows.map((r) => r.map((s) => s.trim()));
}

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Download an .xlsx template in the requested shape (uses SheetJS). */
export function downloadTemplate(shape: parse.Shape = "long"): void {
  const XLSX = getXLSX();
  const ws = XLSX.utils.aoa_to_sheet(parse.templateRows(shape));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "data");
  const out = XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
  triggerDownload(new Blob([out], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), `plotter-template-${shape}.xlsx`);
}

/** Export the current scene as a standalone, editable SVG. */
export function exportSvg(scene: Scene, title: string): void {
  const svg = plot.serializeSvg(scene);
  triggerDownload(new Blob([svg], { type: "image/svg+xml" }), `${plot.fileStem(title)}.svg`);
}

/**
 * Export PNG honoring width×height (mm) and DPI. The SVG is drawn to a canvas
 * sized to the physical figure at the target DPI (scale = dpi/96), so 300 DPI
 * yields a crisp raster suitable for publication.
 */
export function exportPng(scene: Scene, opts: { widthMm: number; heightMm: number; dpi: number; title: string }): Promise<void> {
  const svg = plot.serializeSvg(scene);
  const scale = plot.dpiScale(opts.dpi);
  const pxW = Math.round(plot.mmToPx(opts.widthMm) * scale);
  const pxH = Math.round(plot.mmToPx(opts.heightMm) * scale);
  return new Promise((resolve, reject) => {
    const img = new Image();
    const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = pxW;
      canvas.height = pxH;
      const ctx = canvas.getContext("2d");
      if (!ctx) { reject(new Error("Canvas unsupported")); return; }
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, pxW, pxH);
      ctx.drawImage(img, 0, 0, pxW, pxH);
      URL.revokeObjectURL(url);
      canvas.toBlob((b) => {
        if (b) { triggerDownload(b, `${plot.fileStem(opts.title)}_${opts.dpi}dpi.png`); resolve(); }
        else reject(new Error("PNG encode failed"));
      }, "image/png");
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("SVG render failed")); };
    img.src = url;
  });
}

/** Map ParsedData back onto the UI state's cell grid for the given groups. */
export function datasetFromParsed(parsed: parse.ParsedData): Dataset {
  return {
    xLabels: parsed.xLabels,
    groups: parsed.groupNames.map((name) => ({ name, color: "", marker: "circle", line: "solid" })),
    cells: parsed.cells,
  };
}

// ---------------------------------------------------------------------------
// Public surface
// ---------------------------------------------------------------------------

const PlotterEngine = {
  stats,
  parse,
  plot,
  specFromState,
  computeBrackets,
  buildScene: plot.buildScene,
  toReact,
  serializeSvg: plot.serializeSvg,
  parseFile,
  downloadTemplate,
  exportSvg,
  exportPng,
  datasetFromParsed,
  themes: plot.THEMES,
  defaultTheme: plot.DEFAULT_THEME,
  fontOptions: plot.FONT_OPTIONS,
};

export type PlotterEngineApi = typeof PlotterEngine;

(globalThis as any).PlotterEngine = PlotterEngine;

export default PlotterEngine;
