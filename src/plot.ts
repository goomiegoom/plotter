/**
 * Rendering engine — builds a GraphPad-Prism-styled chart as a tree of plain
 * scene nodes ({@link El}). No React, no DOM: the dc-runtime UI converts the
 * tree to `React.createElement` for live display, while {@link serializeSvg}
 * turns the *same* tree into a standalone SVG string for vector export (opens
 * in Illustrator/Inkscape with editable text). PNG export rasterizes that SVG.
 *
 * Everything here is deterministic and unit-testable: see `plot.test.ts` for
 * the layout math (bracket auto-stacking, mm→px, DPI scaling).
 */

import type { ErrorType, MarkerShape, LineStyle, PlotType } from "./types";

// ---------------------------------------------------------------------------
// Scene node
// ---------------------------------------------------------------------------

export interface El {
  tag: string;
  attrs: Record<string, string | number>;
  children: Array<El | string>;
}

export function el(
  tag: string,
  attrs: Record<string, string | number | undefined> = {},
  ...children: Array<El | string | null | undefined>
): El {
  const clean: Record<string, string | number> = {};
  for (const [k, v] of Object.entries(attrs)) if (v !== undefined) clean[k] = v;
  return {
    tag,
    attrs: clean,
    children: children.filter((c): c is El | string => c != null),
  };
}

// ---------------------------------------------------------------------------
// Prism theme constants
// ---------------------------------------------------------------------------

const INK = "#1f2733";
const FONT = "Helvetica, Arial, sans-serif";
const AXIS_W = 1.5; // ~1.5px axis lines
const TICK_LEN = 6; // outward tick length
const MARKER_R = 3.5; // ~7px diameter markers
const LINE_W = 2;

// ---------------------------------------------------------------------------
// Public spec
// ---------------------------------------------------------------------------

export interface LinePoint {
  xLabel: string;
  xNum: number;
  mean: number;
  err: number;
  n: number;
  values: number[];
}

export interface GroupAgg {
  mean: number;
  err: number;
  sd: number;
  n: number;
  values: number[];
}

export interface RenderSeries {
  name: string;
  color: string;
  marker: MarkerShape;
  line: LineStyle;
  points: LinePoint[];
  agg: GroupAgg;
}

/** A significance bracket between two category/series indices. */
export interface SceneBracket {
  aIndex: number;
  bIndex: number;
  label: string;
  isNs: boolean;
  /** for line "compare at each X": the X column the bracket belongs to */
  xIndex?: number;
}

export interface BracketConfig {
  height: number; // vertical step between stack levels
  gap: number; // gap above data before the first bracket
  cap: number; // downward end-cap length
}

export const DEFAULT_BRACKET_CONFIG: BracketConfig = { height: 22, gap: 14, cap: 6 };

export interface PlotSpec {
  plotType: PlotType;
  errorType: ErrorType;
  xAxisType: "numeric" | "categorical";
  series: RenderSeries[];
  xLabels: string[];
  xTitle: string;
  yTitle: string;
  plotTitle: string;
  yAuto: boolean;
  yMin: number;
  yMax: number;
  yLog: boolean;
  xLog: boolean;
  gridlines: boolean;
  legendPos: "top-right" | "outside-right" | "none";
  barWidth: number; // 20..90 (% of slot)
  barOutline: boolean;
  violinInner: "box" | "meansd" | "none";
  showPoints: boolean;
  showSig: boolean;
  compareAtEachX: boolean;
  sigDisplay: "asterisks" | "pvalue" | "ns";
  brackets: SceneBracket[];
  bracketConfig?: BracketConfig;
}

export interface Scene {
  root: El;
  width: number;
  height: number;
}

// ---------------------------------------------------------------------------
// Bracket auto-stacking (pure, tested)
// ---------------------------------------------------------------------------

/**
 * Assign a vertical level to each bracket so overlapping spans never collide.
 * Greedy interval scheduling: process by ascending span width, drop each
 * bracket on the lowest level whose currently-occupied x-extent doesn't
 * overlap it. Returns levels in input order.
 */
export function assignBracketLevels(
  spans: Array<[number, number]>
): number[] {
  const order = spans
    .map((s, i) => ({ lo: Math.min(s[0], s[1]), hi: Math.max(s[0], s[1]), i }))
    .sort((a, b) => a.hi - a.lo - (b.hi - b.lo) || a.lo - b.lo);
  const levelRanges: Array<Array<[number, number]>> = [];
  const levels = new Array<number>(spans.length).fill(0);
  for (const s of order) {
    let lvl = 0;
    for (;;) {
      const occupied = levelRanges[lvl] ?? [];
      const clash = occupied.some(([lo, hi]) => s.lo <= hi && lo <= s.hi);
      if (!clash) {
        (levelRanges[lvl] ??= []).push([s.lo, s.hi]);
        levels[s.i] = lvl;
        break;
      }
      lvl++;
    }
  }
  return levels;
}

// ---------------------------------------------------------------------------
// Unit conversion / export helpers (pure, tested)
// ---------------------------------------------------------------------------

/** Millimetres → CSS pixels at 96 dpi. */
export function mmToPx(mm: number): number {
  return (mm / 25.4) * 96;
}

/** Plotly-style scale factor to reach a target DPI from a 96-dpi baseline. */
export function dpiScale(dpi: number): number {
  return dpi / 96;
}

/** Sanitize a plot title into a safe file-name stem. */
export function fileStem(title: string, fallback = "plot"): string {
  const s = (title || "").trim().replace(/[^\w\- ]+/g, "").replace(/\s+/g, "_");
  return s || fallback;
}

// ---------------------------------------------------------------------------
// Geometry
// ---------------------------------------------------------------------------

const PLOT = 416;
const X0 = 96;
const Y0 = 46;

function dataMaxMin(spec: PlotSpec): { dmax: number; dmin: number } {
  let dmax = -Infinity;
  let dmin = Infinity;
  const consider = (v: number) => {
    if (!Number.isFinite(v)) return;
    if (v > dmax) dmax = v;
    if (v < dmin) dmin = v;
  };
  for (const s of spec.series) {
    if (spec.plotType === "line") {
      for (const p of s.points) {
        consider(p.mean + p.err);
        consider(p.mean - p.err);
      }
    } else {
      consider(s.agg.mean + s.agg.err);
      consider(s.agg.mean - s.agg.err);
      for (const v of s.agg.values) consider(v);
    }
  }
  if (dmax === -Infinity) {
    dmax = 1;
    dmin = 0;
  }
  return { dmax, dmin };
}

// ---------------------------------------------------------------------------
// Main builder
// ---------------------------------------------------------------------------

export function buildScene(spec: PlotSpec): Scene {
  const isLine = spec.plotType === "line";
  const isBar = spec.plotType === "bar";
  const isViolin = spec.plotType === "violin";
  const outside = spec.legendPos === "outside-right";
  const cfg = spec.bracketConfig ?? DEFAULT_BRACKET_CONFIG;

  const X1 = X0 + PLOT;
  const Y1 = Y0 + PLOT;
  const W = PLOT;
  const H = PLOT;
  const SVGW = outside ? X1 + 172 : X1 + 44;
  const SVGH = Y1 + 60;

  const { dmax, dmin } = dataMaxMin(spec);

  // ---- Y domain ----
  let bottom: number;
  let top: number;
  if (spec.yLog) {
    const posMin = dmin > 0 ? dmin : dmax > 0 ? dmax / 100 : 0.1;
    bottom = spec.yAuto ? Math.pow(10, Math.floor(Math.log10(posMin))) : Math.max(1e-9, spec.yMin);
    top = spec.yAuto ? Math.pow(10, Math.ceil(Math.log10(dmax * 1.05))) : spec.yMax;
    if (top <= bottom) top = bottom * 10;
  } else if (spec.yAuto) {
    bottom = Math.min(0, dmin);
    top = Math.max(bottom + 1, Math.ceil((dmax * 1.12) / 20) * 20 || 20);
  } else {
    bottom = spec.yMin;
    top = spec.yMax;
    if (top <= bottom) top = bottom + 20;
  }

  const yToPx = (v: number): number => {
    if (spec.yLog) {
      const lv = Math.log10(Math.max(v, 1e-12));
      const lb = Math.log10(bottom);
      const lt = Math.log10(top);
      return Y1 - ((lv - lb) / (lt - lb)) * H;
    }
    return Y1 - ((v - bottom) / (top - bottom)) * H;
  };

  // ---- X positions ----
  const nCat = isLine ? spec.xLabels.length : spec.series.length;
  const xCat = (i: number): number => X0 + W * ((i + 0.5) / Math.max(1, nCat));
  // numeric line domain
  const xNums = spec.series[0]?.points.map((p) => p.xNum) ?? [];
  const xNumMin = Math.min(...(xNums.length ? xNums : [0]));
  const xNumMax = Math.max(...(xNums.length ? xNums : [1]));
  const xLineNumeric = (xn: number): number => {
    if (spec.xLog) {
      const a = Math.log10(Math.max(xn, 1e-12));
      const lo = Math.log10(Math.max(xNumMin, 1e-12));
      const hi = Math.log10(Math.max(xNumMax, 1e-12));
      return X0 + (hi === lo ? W / 2 : ((a - lo) / (hi - lo)) * W);
    }
    return X0 + (xNumMax === xNumMin ? W / 2 : ((xn - xNumMin) / (xNumMax - xNumMin)) * W);
  };
  const xLineCat = (i: number, n: number): number => X0 + (n <= 1 ? W / 2 : W * (i / (n - 1)));
  const lineX = (p: LinePoint, i: number, n: number): number =>
    spec.xAxisType === "numeric" ? xLineNumeric(p.xNum) : xLineCat(i, n);

  const kids: Array<El | string> = [];

  // ---- title ----
  if (spec.plotTitle) {
    kids.push(
      el("text", { x: (X0 + X1) / 2, y: 28, "text-anchor": "middle", "font-size": 16, "font-weight": 700, "font-family": FONT, fill: INK }, spec.plotTitle)
    );
  }

  // ---- y tick values ----
  const tickVals: number[] = [];
  if (spec.yLog) {
    const lo = Math.floor(Math.log10(bottom));
    const hi = Math.ceil(Math.log10(top));
    for (let e = lo; e <= hi; e++) tickVals.push(Math.pow(10, e));
  } else {
    const nTicks = 5;
    for (let i = 0; i <= nTicks; i++) tickVals.push(bottom + ((top - bottom) * i) / nTicks);
  }

  // ---- gridlines ----
  if (spec.gridlines) {
    tickVals.forEach((v, i) =>
      kids.push(el("line", { key: "grid" + i, x1: X0, y1: yToPx(v), x2: X1, y2: yToPx(v), stroke: "#eceff3", "stroke-width": 1 }))
    );
  }

  // ---- axes (left + bottom only) ----
  kids.push(el("line", { x1: X0, y1: Y0 - 4, x2: X0, y2: Y1, stroke: INK, "stroke-width": AXIS_W }));
  kids.push(el("line", { x1: X0, y1: Y1, x2: X1 + 4, y2: Y1, stroke: INK, "stroke-width": AXIS_W }));

  // ---- y ticks (outward) + labels ----
  tickVals.forEach((v) => {
    kids.push(el("line", { x1: X0 - TICK_LEN, y1: yToPx(v), x2: X0, y2: yToPx(v), stroke: INK, "stroke-width": AXIS_W }));
    kids.push(
      el("text", { x: X0 - TICK_LEN - 4, y: yToPx(v) + 4, "text-anchor": "end", "font-size": 13, "font-family": FONT, fill: INK }, fmtTick(v, spec.yLog))
    );
  });

  // ---- x ticks + labels ----
  const xTickLabels = isLine ? spec.xLabels : spec.series.map((s) => s.name);
  const xTickPos = (i: number): number =>
    isLine ? lineX(spec.series[0]?.points[i] ?? { xNum: i } as LinePoint, i, nCat) : xCat(i);
  xTickLabels.forEach((lab, i) => {
    const cx = xTickPos(i);
    kids.push(el("line", { x1: cx, y1: Y1, x2: cx, y2: Y1 + TICK_LEN, stroke: INK, "stroke-width": AXIS_W }));
    kids.push(el("text", { x: cx, y: Y1 + 20, "text-anchor": "middle", "font-size": 13, "font-family": FONT, fill: INK }, lab));
  });

  // ---- axis titles ----
  kids.push(el("text", { x: (X0 + X1) / 2, y: Y1 + 44, "text-anchor": "middle", "font-size": 14, "font-weight": 600, "font-family": FONT, fill: INK }, spec.xTitle));
  const ymid = (Y0 + Y1) / 2;
  kids.push(el("text", { x: 24, y: ymid, "text-anchor": "middle", "font-size": 14, "font-weight": 600, "font-family": FONT, fill: INK, transform: `rotate(-90 24 ${ymid})` }, spec.yTitle));

  // ---- helpers ----
  const markerEl = (cx: number, cy: number, shape: MarkerShape, color: string, sz = MARKER_R): El => {
    if (shape === "square") return el("rect", { x: cx - sz, y: cy - sz, width: sz * 2, height: sz * 2, fill: color, stroke: "#fff", "stroke-width": 0.8 });
    if (shape === "triangle") return el("polygon", { points: `${cx},${cy - sz * 1.15} ${cx + sz * 1.1},${cy + sz} ${cx - sz * 1.1},${cy + sz}`, fill: color, stroke: "#fff", "stroke-width": 0.8 });
    if (shape === "diamond") return el("polygon", { points: `${cx},${cy - sz * 1.25} ${cx + sz * 1.1},${cy} ${cx},${cy + sz * 1.25} ${cx - sz * 1.1},${cy}`, fill: color, stroke: "#fff", "stroke-width": 0.8 });
    return el("circle", { cx, cy, r: sz, fill: color, stroke: "#fff", "stroke-width": 0.8 });
  };
  const ebar = (cx: number, m: number, e: number, color: string): El | null => {
    if (!(e > 0)) return null;
    return el(
      "g",
      { stroke: color, "stroke-width": AXIS_W },
      el("line", { x1: cx, y1: yToPx(m + e), x2: cx, y2: yToPx(m - e) }),
      el("line", { x1: cx - 4, y1: yToPx(m + e), x2: cx + 4, y2: yToPx(m + e) }),
      el("line", { x1: cx - 4, y1: yToPx(m - e), x2: cx + 4, y2: yToPx(m - e) })
    );
  };
  const jitter = (k: number): number => ((Math.sin(k * 12.9898) * 43758.5453) % 1 + 1) % 1;

  // ===== LINE =====
  if (isLine) {
    spec.series.forEach((s) => {
      const pts = s.points.map((p, i) => ({ cx: lineX(p, i, nCat), m: p.mean, e: p.err }));
      const d = pts.map((p, i) => (i === 0 ? "M" : "L") + p.cx + " " + yToPx(p.m)).join(" ");
      kids.push(el("path", { d, fill: "none", stroke: s.color, "stroke-width": LINE_W, "stroke-dasharray": s.line === "dashed" ? "6 4" : "none", "stroke-linejoin": "round" }));
      pts.forEach((p) => { const e = ebar(p.cx, p.m, p.e, s.color); if (e) kids.push(e); });
      pts.forEach((p) => kids.push(markerEl(p.cx, yToPx(p.m), s.marker, s.color)));
    });
  }

  // ===== BAR (clustered: one bar per group) =====
  if (isBar) {
    const slot = W / Math.max(1, nCat);
    const bw = slot * (spec.barWidth / 100);
    const baseV = spec.yLog ? bottom : Math.max(bottom, 0);
    spec.series.forEach((s, gi) => {
      const cx = xCat(gi);
      const x = cx - bw / 2;
      const yTop = yToPx(s.agg.mean);
      kids.push(el("rect", { x, y: yTop, width: bw, height: Math.max(0, yToPx(baseV) - yTop), fill: s.color, "fill-opacity": 0.92, stroke: spec.barOutline ? INK : "none", "stroke-width": spec.barOutline ? 1.3 : 0 }));
      const e = ebar(cx, s.agg.mean, s.agg.err, INK);
      if (e) kids.push(e);
      if (spec.showPoints) {
        s.agg.values.forEach((v, k) =>
          kids.push(el("circle", { cx: cx + (jitter(gi * 7 + k) - 0.5) * bw * 0.55, cy: yToPx(v), r: 2.2, fill: INK, "fill-opacity": 0.55 }))
        );
      }
    });
  }

  // ===== VIOLIN (one per group, spanmode hard) =====
  if (isViolin) {
    const slot = W / Math.max(1, nCat);
    const halfW = Math.min(34, slot * 0.34);
    spec.series.forEach((s, gi) => {
      const vals = s.agg.values;
      const cx = xCat(gi);
      const lo = vals.length ? Math.min(...vals) : s.agg.mean;
      const hi = vals.length ? Math.max(...vals) : s.agg.mean;
      const bw = silvermanBandwidth(vals, s.agg.sd);
      const N = 36;
      const profile: Array<[number, number]> = [];
      let peak = 1e-9;
      for (let k = 0; k <= N; k++) {
        const v = lo + ((hi - lo) * k) / N; // spanmode: 'hard' — truncate to data range
        const dens = kde(v, vals, bw);
        profile.push([v, dens]);
        if (dens > peak) peak = dens;
      }
      let d = "";
      profile.forEach((p, k) => { d += (k === 0 ? "M" : "L") + (cx - (p[1] / peak) * halfW) + " " + yToPx(p[0]) + " "; });
      for (let k = profile.length - 1; k >= 0; k--) d += "L" + (cx + (profile[k][1] / peak) * halfW) + " " + yToPx(profile[k][0]) + " ";
      d += "Z";
      kids.push(el("path", { d, fill: s.color, "fill-opacity": 0.32, stroke: s.color, "stroke-width": 1.6, "stroke-linejoin": "round" }));
      if (spec.showPoints) {
        vals.forEach((v, k) =>
          kids.push(el("circle", { cx: cx + (jitter(gi * 5 + k) - 0.5) * halfW * 0.7, cy: yToPx(v), r: 2.2, fill: s.color, "fill-opacity": 0.85 }))
        );
      }
      if (spec.violinInner === "box") {
        const sorted = [...vals].sort((a, b) => a - b);
        const q1 = quantile(sorted, 0.25);
        const q3 = quantile(sorted, 0.75);
        const med = quantile(sorted, 0.5);
        kids.push(el("rect", { x: cx - 6, y: yToPx(q3), width: 12, height: Math.max(1, yToPx(q1) - yToPx(q3)), fill: "#fff", stroke: INK, "stroke-width": 1.3 }));
        kids.push(el("line", { x1: cx - 6, y1: yToPx(med), x2: cx + 6, y2: yToPx(med), stroke: INK, "stroke-width": 1.6 }));
      } else if (spec.violinInner === "meansd") {
        const sd = s.agg.sd || 0;
        kids.push(el("line", { x1: cx, y1: yToPx(s.agg.mean + sd), x2: cx, y2: yToPx(s.agg.mean - sd), stroke: INK, "stroke-width": 1.5 }));
        kids.push(markerEl(cx, yToPx(s.agg.mean), "circle", INK, 3.5));
      }
    });
  }

  // ===== SIGNIFICANCE =====
  if (spec.showSig && spec.brackets.length) {
    if (isLine && spec.compareAtEachX) {
      kids.push(...buildPerXMarkers(spec, lineX, yToPx, nCat));
    } else if (isLine) {
      kids.push(...buildSeriesAnnotations(spec, X0, Y0));
    } else {
      kids.push(...buildHorizontalBrackets(spec, xCat, yToPx, cfg, Y0));
    }
  }

  // ===== LEGEND =====
  if (spec.legendPos !== "none") {
    const lx = outside ? X1 + 22 : X1 - 132;
    const ly0 = Y0 + 6;
    spec.series.forEach((s, gi) => {
      const y = ly0 + gi * 20;
      const entry: Array<El> = [];
      if (isLine) {
        entry.push(el("line", { x1: lx, y1: y, x2: lx + 22, y2: y, stroke: s.color, "stroke-width": LINE_W, "stroke-dasharray": s.line === "dashed" ? "5 4" : "none" }));
        entry.push(markerEl(lx + 11, y, s.marker, s.color, 3.5));
      } else {
        entry.push(el("rect", { x: lx + 2, y: y - 6, width: 16, height: 12, fill: s.color, "fill-opacity": isViolin ? 0.5 : 0.92, stroke: s.color, "stroke-width": 1 }));
      }
      entry.push(el("text", { x: lx + 28, y: y + 4, "text-anchor": "start", "font-size": 13, "font-family": FONT, fill: INK }, s.name));
      // The group wrapper carries the series index so the UI can make legend
      // entries clickable in "manual comparison" mode (see toReact decorator).
      kids.push(el("g", { "data-series-index": gi }, ...entry));
    });
  }

  const root = el(
    "svg",
    { xmlns: "http://www.w3.org/2000/svg", viewBox: `0 0 ${SVGW} ${SVGH}`, width: SVGW, height: SVGH, "font-family": FONT },
    ...kids
  );
  return { root, width: SVGW, height: SVGH };
}

// ---- significance sub-builders ----

function buildHorizontalBrackets(
  spec: PlotSpec,
  xCat: (i: number) => number,
  yToPx: (v: number) => number,
  cfg: BracketConfig,
  Y0: number
): El[] {
  const spans = spec.brackets.map((b) => [b.aIndex, b.bIndex] as [number, number]);
  const levels = assignBracketLevels(spans);
  // baseline: just above the tallest data+error across the spanned categories
  const out: El[] = [];
  spec.brackets.forEach((b, idx) => {
    const xi = xCat(b.aIndex);
    const xj = xCat(b.bIndex);
    const topData = Math.min(
      seriesTopPx(spec, b.aIndex, yToPx),
      seriesTopPx(spec, b.bIndex, yToPx)
    );
    const yb = Math.min(topData, Y0 + 4) - cfg.gap - levels[idx] * cfg.height;
    out.push(bracketEl(xi, xj, yb, cfg.cap, b.label, b.isNs));
  });
  return out;
}

function seriesTopPx(spec: PlotSpec, i: number, yToPx: (v: number) => number): number {
  const s = spec.series[i];
  if (!s) return Infinity;
  const top = s.agg.mean + s.agg.err;
  const maxVal = s.agg.values.length ? Math.max(...s.agg.values) : top;
  return yToPx(Math.max(top, maxVal));
}

function bracketEl(xi: number, xj: number, yb: number, cap: number, label: string, isNs: boolean): El {
  return el(
    "g",
    {},
    el("line", { x1: xi, y1: yb, x2: xj, y2: yb, stroke: INK, "stroke-width": 1.2 }),
    el("line", { x1: xi, y1: yb, x2: xi, y2: yb + cap, stroke: INK, "stroke-width": 1.2 }),
    el("line", { x1: xj, y1: yb, x2: xj, y2: yb + cap, stroke: INK, "stroke-width": 1.2 }),
    el(
      "text",
      { x: (xi + xj) / 2, y: yb - (isNs ? 3 : 1), "text-anchor": "middle", "font-size": isNs ? 11 : 15, "font-style": isNs ? "italic" : "normal", "font-weight": isNs ? 400 : 700, "font-family": FONT, fill: isNs ? "#6b7280" : INK },
      label
    )
  );
}

function buildPerXMarkers(
  spec: PlotSpec,
  lineX: (p: LinePoint, i: number, n: number) => number,
  yToPx: (v: number) => number,
  nCat: number
): El[] {
  const out: El[] = [];
  // group brackets by xIndex, stack vertically per X position
  const byX = new Map<number, SceneBracket[]>();
  for (const b of spec.brackets) {
    const xi = b.xIndex ?? 0;
    (byX.get(xi) ?? byX.set(xi, []).get(xi)!).push(b);
  }
  for (const [xi, list] of byX) {
    const p0 = spec.series[0]?.points[xi];
    if (!p0) continue;
    const cx = lineX(p0, xi, nCat);
    // top of the tallest point at this X
    let topPx = Infinity;
    for (const s of spec.series) {
      const p = s.points[xi];
      if (p) topPx = Math.min(topPx, yToPx(p.mean + p.err));
    }
    list.forEach((b, k) => {
      const y = topPx - 10 - k * 14;
      out.push(
        el("text", { x: cx, y, "text-anchor": "middle", "font-size": b.isNs ? 10 : 14, "font-style": b.isNs ? "italic" : "normal", "font-weight": b.isNs ? 400 : 700, "font-family": FONT, fill: b.isNs ? "#6b7280" : INK }, b.label)
      );
    });
  }
  return out;
}

function buildSeriesAnnotations(spec: PlotSpec, X0: number, Y0: number): El[] {
  // For whole-series line comparisons (no per-X mode): a compact stacked list.
  const out: El[] = [];
  spec.brackets.forEach((b, i) => {
    const a = spec.series[b.aIndex]?.name ?? "?";
    const bb = spec.series[b.bIndex]?.name ?? "?";
    out.push(
      el("text", { x: X0 + 8, y: Y0 + 12 + i * 16, "text-anchor": "start", "font-size": 12, "font-family": FONT, fill: b.isNs ? "#6b7280" : INK }, `${a} vs ${bb}: ${b.label}`)
    );
  });
  return out;
}

// ---- math helpers for violin ----

function silvermanBandwidth(values: number[], sd: number): number {
  const n = values.length;
  if (n < 2) return Math.max(sd, 1) || 1;
  const h = 1.06 * (sd || 1) * Math.pow(n, -1 / 5);
  return h > 0 ? h : 1;
}

function kde(x: number, values: number[], bw: number): number {
  if (!values.length || bw <= 0) return 0;
  let s = 0;
  for (const v of values) {
    const u = (x - v) / bw;
    s += Math.exp(-0.5 * u * u);
  }
  return s / (values.length * bw * Math.sqrt(2 * Math.PI));
}

function quantile(sorted: number[], q: number): number {
  if (!sorted.length) return 0;
  const pos = (sorted.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  return sorted[base + 1] !== undefined ? sorted[base] + rest * (sorted[base + 1] - sorted[base]) : sorted[base];
}

function fmtTick(v: number, log: boolean): string {
  if (log) {
    const e = Math.round(Math.log10(v));
    if (Math.abs(Math.pow(10, e) - v) / v < 1e-6) {
      if (e >= 0 && e <= 3) return String(Math.round(v));
      return "1e" + e;
    }
  }
  const r = Math.round(v * 100) / 100;
  return String(r);
}

// ---------------------------------------------------------------------------
// SVG serialization
// ---------------------------------------------------------------------------

const VOID_TAGS = new Set(["line", "rect", "circle", "polygon", "path"]);

function escapeAttr(v: string): string {
  return v.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}
function escapeText(v: string): string {
  return v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Serialize a scene node to an SVG string (drops React-only `key` attrs). */
export function serializeEl(node: El | string): string {
  if (typeof node === "string") return escapeText(node);
  const attrs = Object.entries(node.attrs)
    .filter(([k]) => k !== "key")
    .map(([k, v]) => `${k}="${escapeAttr(String(v))}"`)
    .join(" ");
  const open = attrs ? `<${node.tag} ${attrs}>` : `<${node.tag}>`;
  if (node.children.length === 0 && VOID_TAGS.has(node.tag)) {
    return attrs ? `<${node.tag} ${attrs}/>` : `<${node.tag}/>`;
  }
  const inner = node.children.map(serializeEl).join("");
  return `${open}${inner}</${node.tag}>`;
}

/** Full standalone SVG document string for vector export. */
export function serializeSvg(scene: Scene): string {
  return `<?xml version="1.0" encoding="UTF-8"?>\n` + serializeEl(scene.root);
}
