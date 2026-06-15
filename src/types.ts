// Shared types for the Plotter stats + plotting engine.
// These mirror the shape of the dc-runtime component state in Plotter.dc.html
// so the engine can be driven directly from the UI with no adapter layer.

export type PlotType = "line" | "bar" | "violin";
export type ErrorType = "sd" | "sem" | "ci";
export type MarkerShape = "circle" | "square" | "triangle" | "diamond";
export type LineStyle = "solid" | "dashed";

/** One plotted series (a "group" in the UI). */
export interface SeriesStyle {
  name: string;
  color: string;
  marker: MarkerShape;
  line: LineStyle;
}

/**
 * The canonical dataset the whole engine speaks.
 *
 * `cells[groupIndex][xIndex]` is the list of raw replicate values (as typed in
 * the grid or read from a file) for that group at that X position. Blank /
 * non-numeric entries are tolerated everywhere — they are filtered out and `n`
 * is recomputed per point.
 */
export interface Dataset {
  groups: SeriesStyle[];
  xLabels: string[];
  cells: string[][][];
}

/** Descriptive statistics for a single (group, x) point. */
export interface PointStats {
  /** number of valid (numeric, non-blank) replicates */
  n: number;
  mean: number;
  /** sample standard deviation (n-1 denominator); 0 when n < 2 */
  sd: number;
  /** standard error of the mean = sd / sqrt(n); 0 when n < 2 */
  sem: number;
  /** half-width of the 95% CI = t(0.975, n-1) * sem; 0 when n < 2 */
  ci95: number;
  /** the raw numeric values that survived cleaning */
  values: number[];
}
