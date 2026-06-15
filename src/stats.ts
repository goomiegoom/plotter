/**
 * Plotter statistics engine — pure, dependency-free TypeScript.
 *
 * Everything here is a pure function of its inputs (no DOM, no globals), which
 * is what makes the Jest suite in `stats.test.ts` possible and what lets the
 * same code run unchanged inside the dc-runtime UI bundle.
 *
 * Distributions
 * -------------
 * The task spec suggests jStat for the t- and F-distribution CDFs. We instead
 * implement the regularized incomplete beta function directly (Numerical
 * Recipes continued fraction) and derive Student-t / Fisher-F / normal tails
 * from it. The numbers agree with jStat / R to well within plotting precision
 * (see the tests), and the self-contained implementation keeps the static
 * Vercel build free of an extra runtime dependency. Swapping in jStat later is
 * a drop-in replacement for `studentTTwoTailedP`, `fUpperTailP`, `normalCdf`.
 */

import type { PointStats } from "./types";

// ---------------------------------------------------------------------------
// Special functions
// ---------------------------------------------------------------------------

/** Lanczos approximation of ln Γ(x). */
export function logGamma(x: number): number {
  const c = [
    76.18009172947146, -86.50532032941677, 24.01409824083091,
    -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5,
  ];
  let y = x;
  let tmp = x + 5.5;
  tmp -= (x + 0.5) * Math.log(tmp);
  let ser = 1.000000000190015;
  for (let j = 0; j < 6; j++) {
    y += 1;
    ser += c[j] / y;
  }
  return -tmp + Math.log((2.5066282746310005 * ser) / x);
}

/**
 * Regularized incomplete beta function I_x(a, b).
 * Continued-fraction evaluation (Numerical Recipes `betai`/`betacf`).
 */
export function incompleteBeta(x: number, a: number, b: number): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const lbeta =
    logGamma(a + b) - logGamma(a) - logGamma(b) + a * Math.log(x) + b * Math.log(1 - x);
  const front = Math.exp(lbeta);
  // Choose the more rapidly converging tail.
  if (x < (a + 1) / (a + b + 2)) {
    return (front * betacf(x, a, b)) / a;
  }
  return 1 - (front * betacf(1 - x, b, a)) / b;
}

function betacf(x: number, a: number, b: number): number {
  const MAXIT = 200;
  const EPS = 3e-12;
  const FPMIN = 1e-300;
  const qab = a + b;
  const qap = a + 1;
  const qam = a - 1;
  let c = 1;
  let d = 1 - (qab * x) / qap;
  if (Math.abs(d) < FPMIN) d = FPMIN;
  d = 1 / d;
  let h = d;
  for (let m = 1; m <= MAXIT; m++) {
    const m2 = 2 * m;
    let aa = (m * (b - m) * x) / ((qam + m2) * (a + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c;
    if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d;
    h *= d * c;
    aa = (-(a + m) * (qab + m) * x) / ((a + m2) * (qap + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c;
    if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < EPS) break;
  }
  return h;
}

/** Error function via Abramowitz & Stegun 7.1.26 (|error| < 1.5e-7). */
export function erf(x: number): number {
  const sign = x < 0 ? -1 : 1;
  const ax = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * ax);
  const y =
    1 -
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t +
      0.254829592) *
      t *
      Math.exp(-ax * ax);
  return sign * y;
}

/** Standard normal CDF Φ(z). */
export function normalCdf(z: number): number {
  return 0.5 * (1 + erf(z / Math.SQRT2));
}

/**
 * Two-tailed p-value for a Student-t statistic with `df` degrees of freedom:
 * P(|T| >= |t|) = I_{df/(df+t^2)}(df/2, 1/2).
 */
export function studentTTwoTailedP(t: number, df: number): number {
  if (!isFinite(t) || df <= 0) return NaN;
  const x = df / (df + t * t);
  return clampP(incompleteBeta(x, df / 2, 0.5));
}

/** Student-t CDF, P(T <= t). */
export function studentTCdf(t: number, df: number): number {
  const p = 0.5 * incompleteBeta(df / (df + t * t), df / 2, 0.5);
  return t >= 0 ? 1 - p : p;
}

/**
 * Critical t value t(p, df): the value with cumulative probability `p`.
 * Bisection on the CDF — used for two-sided CI half-widths (p = 0.975).
 */
export function studentTInv(p: number, df: number): number {
  if (p <= 0) return -Infinity;
  if (p >= 1) return Infinity;
  let lo = -1000;
  let hi = 1000;
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    if (studentTCdf(mid, df) < p) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

/** Upper-tail p-value for an F statistic: P(F >= f). */
export function fUpperTailP(f: number, df1: number, df2: number): number {
  if (df1 <= 0 || df2 <= 0 || Number.isNaN(f)) return NaN;
  if (f <= 0) return 1; // P(F >= 0) = 1
  const x = (df1 * f) / (df1 * f + df2);
  return clampP(1 - incompleteBeta(x, df1 / 2, df2 / 2));
}

function clampP(p: number): number {
  if (!isFinite(p)) return p;
  return Math.min(1, Math.max(0, p));
}

// ---------------------------------------------------------------------------
// Cleaning + descriptive statistics
// ---------------------------------------------------------------------------

/**
 * Coerce a cell (an array of replicate strings, or a single delimited string)
 * into clean numeric values. Blank / non-numeric entries are dropped so `n` is
 * recomputed per point.
 */
export function cleanValues(raw: string[] | string | number[]): number[] {
  const arr = Array.isArray(raw) ? raw : String(raw).split(/[,\s]+/);
  return arr
    .map((v) => (typeof v === "number" ? v : String(v).trim()))
    .filter((v) => v !== "" && v !== null && v !== undefined)
    .map(Number)
    .filter((x) => !Number.isNaN(x) && Number.isFinite(x));
}

export function mean(values: number[]): number {
  if (!values.length) return 0;
  return values.reduce((s, x) => s + x, 0) / values.length;
}

/** Sample standard deviation (n-1 denominator). 0 when n < 2. */
export function sampleSD(values: number[]): number {
  const n = values.length;
  if (n < 2) return 0;
  const m = mean(values);
  const ss = values.reduce((s, x) => s + (x - m) * (x - m), 0);
  return Math.sqrt(ss / (n - 1));
}

/**
 * Full descriptive stats for one (group, x) point: n, mean, sample SD, SEM and
 * the 95% CI half-width (mean ± t(0.975, n-1)·SEM).
 */
export function describe(raw: string[] | string | number[]): PointStats {
  const values = cleanValues(raw);
  const n = values.length;
  const m = mean(values);
  const sd = sampleSD(values);
  const sem = n > 1 ? sd / Math.sqrt(n) : 0;
  const ci95 = n > 1 ? studentTInv(0.975, n - 1) * sem : 0;
  return { n, mean: m, sd, sem, ci95, values };
}

/** Pick the error-bar half-width for the chosen error type. */
export function errorValue(stats: PointStats, type: "sd" | "sem" | "ci"): number {
  if (type === "sd") return stats.sd;
  if (type === "ci") return stats.ci95;
  return stats.sem;
}

// ---------------------------------------------------------------------------
// Two-sample tests
// ---------------------------------------------------------------------------

export interface TTestResult {
  test: "student" | "welch" | "paired";
  t: number;
  df: number;
  p: number;
}

/** Unpaired (pooled-variance) two-sample t-test. */
export function unpairedT(a: number[], b: number[]): TTestResult {
  const na = a.length;
  const nb = b.length;
  const ma = mean(a);
  const mb = mean(b);
  const va = variance(a);
  const vb = variance(b);
  const df = na + nb - 2;
  const sp2 = ((na - 1) * va + (nb - 1) * vb) / df;
  const se = Math.sqrt(sp2 * (1 / na + 1 / nb));
  const t = (ma - mb) / se;
  return { test: "student", t, df, p: studentTTwoTailedP(t, df) };
}

/** Welch's t-test (unequal variances). */
export function welchT(a: number[], b: number[]): TTestResult {
  const na = a.length;
  const nb = b.length;
  const ma = mean(a);
  const mb = mean(b);
  const va = variance(a);
  const vb = variance(b);
  const sa = va / na;
  const sb = vb / nb;
  const se = Math.sqrt(sa + sb);
  const t = (ma - mb) / se;
  const df = (sa + sb) * (sa + sb) / ((sa * sa) / (na - 1) + (sb * sb) / (nb - 1));
  return { test: "welch", t, df, p: studentTTwoTailedP(t, df) };
}

/** Paired t-test. Requires equal-length, position-matched samples. */
export function pairedT(a: number[], b: number[]): TTestResult {
  if (a.length !== b.length) {
    throw new Error("pairedT: samples must have equal length");
  }
  const diffs = a.map((x, i) => x - b[i]);
  const n = diffs.length;
  const md = mean(diffs);
  const sd = sampleSD(diffs);
  const se = sd / Math.sqrt(n);
  const t = md / se;
  const df = n - 1;
  return { test: "paired", t, df, p: studentTTwoTailedP(t, df) };
}

function variance(values: number[]): number {
  const s = sampleSD(values);
  return s * s;
}

// ---------------------------------------------------------------------------
// Mann–Whitney U (Wilcoxon rank-sum)
// ---------------------------------------------------------------------------

export interface MannWhitneyResult {
  U: number;
  p: number;
  /** "exact" enumeration (small n, no ties) or "normal" approximation. */
  method: "exact" | "normal";
}

/**
 * Mann–Whitney U two-tailed test.
 * - Exact enumeration when there are no ties and the sample is small enough.
 * - Otherwise a normal approximation with continuity + tie correction.
 */
export function mannWhitneyU(a: number[], b: number[]): MannWhitneyResult {
  const n1 = a.length;
  const n2 = b.length;
  const combined = [
    ...a.map((v) => ({ v, g: 0 })),
    ...b.map((v) => ({ v, g: 1 })),
  ].sort((p, q) => p.v - q.v);
  const n = n1 + n2;

  // Average ranks with tie handling.
  const ranks = new Array<number>(n);
  const tieGroups: number[] = [];
  let i = 0;
  while (i < n) {
    let j = i;
    while (j < n - 1 && combined[j + 1].v === combined[i].v) j++;
    const avg = (i + j + 2) / 2; // ranks are 1-based: (i+1 .. j+1) average
    for (let k = i; k <= j; k++) ranks[k] = avg;
    if (j > i) tieGroups.push(j - i + 1);
    i = j + 1;
  }

  let r1 = 0;
  for (let k = 0; k < n; k++) if (combined[k].g === 0) r1 += ranks[k];
  const u1 = r1 - (n1 * (n1 + 1)) / 2;
  const u2 = n1 * n2 - u1;
  const U = Math.min(u1, u2);

  const hasTies = tieGroups.length > 0;
  const combos = choose(n1 + n2, n1);
  if (!hasTies && combos <= 60000) {
    return { U, p: mannWhitneyExactP(n1, n2, U), method: "exact" };
  }

  // Normal approximation with continuity correction and tie correction.
  const mu = (n1 * n2) / 2;
  const tieTerm = tieGroups.reduce((s, t) => s + (t * t * t - t), 0);
  const sigma = Math.sqrt(
    ((n1 * n2) / 12) * (n + 1 - tieTerm / (n * (n - 1)))
  );
  if (sigma === 0) return { U, p: 1, method: "normal" };
  const z = (Math.abs(U - mu) - 0.5) / sigma;
  const p = clampP(2 * (1 - normalCdf(z)));
  return { U, p, method: "normal" };
}

/** Exact two-tailed p from the full U distribution (no ties). */
function mannWhitneyExactP(n1: number, n2: number, Uobs: number): number {
  // dist[u] = number of arrangements giving U = u, via the standard recurrence
  // f_{m,n}(u) = f_{m-1,n}(u-n) + f_{m,n-1}(u).
  const maxU = n1 * n2;
  // Full DP table over m = 0..n1, n = 0..n2.
  const dp: number[][][] = [];
  for (let m = 0; m <= n1; m++) {
    dp[m] = [];
    for (let nn = 0; nn <= n2; nn++) {
      dp[m][nn] = new Array<number>(m * nn + 1).fill(0);
    }
  }
  for (let m = 0; m <= n1; m++) dp[m][0][0] = 1;
  for (let nn = 0; nn <= n2; nn++) dp[0][nn][0] = 1;
  for (let m = 1; m <= n1; m++) {
    for (let nn = 1; nn <= n2; nn++) {
      const size = m * nn;
      for (let u = 0; u <= size; u++) {
        let val = dp[m][nn - 1][u] || 0; // f_{m,n-1}(u)
        if (u - nn >= 0) val += dp[m - 1][nn][u - nn] || 0; // f_{m-1,n}(u-n)
        dp[m][nn][u] = val;
      }
    }
  }
  const counts = dp[n1][n2];
  const total = counts.reduce((s, c) => s + c, 0);
  let le = 0;
  for (let u = 0; u <= Math.min(Uobs, maxU); u++) le += counts[u] || 0;
  // Distribution is symmetric about mn/2; Uobs is the smaller tail, so
  // two-sided p = 2 * P(U <= Uobs), clamped at 1.
  return clampP((2 * le) / total);
}

function choose(n: number, k: number): number {
  if (k < 0 || k > n) return 0;
  k = Math.min(k, n - k);
  let r = 1;
  for (let i = 0; i < k; i++) r = (r * (n - i)) / (i + 1);
  return Math.round(r);
}

// ---------------------------------------------------------------------------
// One-way ANOVA
// ---------------------------------------------------------------------------

export interface AnovaResult {
  F: number;
  df1: number;
  df2: number;
  p: number;
}

/** One-way ANOVA omnibus test across k groups. */
export function oneWayANOVA(groups: number[][]): AnovaResult {
  const valid = groups.filter((g) => g.length > 0);
  const k = valid.length;
  const all = valid.flat();
  const N = all.length;
  const grand = mean(all);
  let ssb = 0;
  let ssw = 0;
  for (const g of valid) {
    const m = mean(g);
    ssb += g.length * (m - grand) * (m - grand);
    for (const x of g) ssw += (x - m) * (x - m);
  }
  const df1 = k - 1;
  const df2 = N - k;
  const msb = ssb / df1;
  const msw = ssw / df2;
  const F = msb / msw;
  return { F, df1, df2, p: fUpperTailP(F, df1, df2) };
}

// ---------------------------------------------------------------------------
// p → symbol
// ---------------------------------------------------------------------------

/** GraphPad-style significance symbol for a p-value. */
export function pToSymbol(p: number): string {
  if (!isFinite(p)) return "ns";
  if (p < 0.0001) return "****";
  if (p < 0.001) return "***";
  if (p < 0.01) return "**";
  if (p < 0.05) return "*";
  return "ns";
}

/** Format a p-value for the "exact p" display mode. */
export function formatP(p: number): string {
  if (!isFinite(p)) return "n/a";
  if (p < 0.0001) return "p<0.0001";
  return "p=" + p.toPrecision(2).replace(/\.?0+$/, "");
}

// ---------------------------------------------------------------------------
// Multiple-comparison correction
// ---------------------------------------------------------------------------

export type Correction = "holm" | "bonferroni" | "none";

/**
 * Adjust a set of raw p-values. "holm" is Holm–Šídák (step-down), the default;
 * "bonferroni" multiplies by the number of comparisons; "none" passes through.
 * Returned array is in the SAME ORDER as the input.
 */
export function adjustPValues(pRaw: number[], method: Correction): number[] {
  const m = pRaw.length;
  if (m === 0) return [];
  if (method === "none") return pRaw.map((p) => clampP(p));
  if (method === "bonferroni") return pRaw.map((p) => clampP(p * m));

  // Holm–Šídák: sort ascending, adjust the i-th (1-based) by
  // 1 - (1 - p)^(m - i + 1), then enforce monotonic non-decreasing order.
  const order = pRaw.map((p, i) => ({ p, i })).sort((a, b) => a.p - b.p);
  const adj = new Array<number>(m);
  let running = 0;
  for (let rank = 0; rank < m; rank++) {
    const { p, i } = order[rank];
    const k = m - rank; // remaining comparisons
    let a = 1 - Math.pow(1 - clampP(p), k);
    a = Math.max(a, running); // monotonicity
    running = a;
    adj[i] = clampP(a);
  }
  return adj;
}

// ---------------------------------------------------------------------------
// Post-hoc comparison interface (the single seam)
// ---------------------------------------------------------------------------

/** A group of values fed to the comparison engine. */
export interface GroupValues {
  index: number;
  name: string;
  values: number[];
}

export type TestFamily = "parametric" | "nonparam";
export type CompareMode = "allpairs" | "control" | "manual";

export interface ComparisonOptions {
  family: TestFamily;
  /** parametric only: pooled t, Welch, or paired. Default "welch". */
  parametric?: "student" | "welch" | "paired";
  mode: CompareMode;
  /** group index used as the control in "vs. control" mode */
  controlIndex?: number;
  /** explicit [a,b] index pairs for "manual" mode */
  pairs?: Array<[number, number]>;
  correction: Correction;
  /** label format for the symbol (purely informational; rendering decides). */
  display?: "asterisks" | "pvalue" | "ns";
}

/** A single resolved pairwise comparison, ready for bracket rendering. */
export interface Comparison {
  groupA: number;
  groupB: number;
  labelA: string;
  labelB: string;
  test: string;
  statistic: number;
  df?: number;
  pRaw: number;
  pAdjusted: number;
  symbol: string;
  /** optional X position for line "compare at each X point" mode */
  xIndex?: number;
}

/**
 * The seam.
 *
 * Rendering code calls `runComparisons(groups, opts)` and never reaches into
 * the individual tests. v1 ships {@link LocalPostHocProvider}, which performs
 * corrected pairwise tests entirely in the browser. A future server-backed
 * provider (POST /api/stats running scipy/statsmodels for Tukey, Dunnett,
 * two-way ANOVA, …) can implement the same {@link PostHocProvider} interface
 * and be installed via {@link setPostHocProvider} — WITHOUT touching any
 * rendering code. The contract is just: same `ComparisonOptions` in, same
 * `Comparison[]` out (groupA/groupB indices, pAdjusted, symbol).
 */
export interface PostHocProvider {
  runComparisons(groups: GroupValues[], opts: ComparisonOptions): Comparison[];
}

function buildPairs(groups: GroupValues[], opts: ComparisonOptions): Array<[number, number]> {
  const n = groups.length;
  if (opts.mode === "manual") {
    return (opts.pairs ?? []).filter(
      ([a, b]) => a !== b && a >= 0 && b >= 0 && a < n && b < n
    );
  }
  if (opts.mode === "control") {
    const c = opts.controlIndex ?? 0;
    const pairs: Array<[number, number]> = [];
    for (let i = 0; i < n; i++) if (i !== c) pairs.push([c, i]);
    return pairs;
  }
  // all pairs
  const pairs: Array<[number, number]> = [];
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) pairs.push([i, j]);
  return pairs;
}

function runOneTest(
  a: number[],
  b: number[],
  opts: ComparisonOptions
): { test: string; statistic: number; df?: number; p: number } {
  if (opts.family === "nonparam") {
    const r = mannWhitneyU(a, b);
    return { test: "mann-whitney", statistic: r.U, p: r.p };
  }
  const kind = opts.parametric ?? "welch";
  const r = kind === "student" ? unpairedT(a, b) : kind === "paired" ? pairedT(a, b) : welchT(a, b);
  return { test: r.test, statistic: r.t, df: r.df, p: r.p };
}

/** Default in-browser provider: corrected pairwise tests. */
export class LocalPostHocProvider implements PostHocProvider {
  runComparisons(groups: GroupValues[], opts: ComparisonOptions): Comparison[] {
    const pairs = buildPairs(groups, opts);
    const raw = pairs.map(([ai, bi]) =>
      runOneTest(groups[ai].values, groups[bi].values, opts)
    );
    const adjusted = adjustPValues(raw.map((r) => r.p), opts.correction);
    return pairs.map(([ai, bi], idx) => {
      const r = raw[idx];
      const pAdjusted = adjusted[idx];
      return {
        groupA: ai,
        groupB: bi,
        labelA: groups[ai].name,
        labelB: groups[bi].name,
        test: r.test,
        statistic: r.statistic,
        df: r.df,
        pRaw: r.p,
        pAdjusted,
        symbol: pToSymbol(pAdjusted),
      };
    });
  }
}

let activeProvider: PostHocProvider = new LocalPostHocProvider();

/** Install a different post-hoc provider (e.g. a future server-backed one). */
export function setPostHocProvider(provider: PostHocProvider): void {
  activeProvider = provider;
}

/** The single public entry point used by the renderer. */
export function runComparisons(
  groups: GroupValues[],
  opts: ComparisonOptions
): Comparison[] {
  return activeProvider.runComparisons(groups, opts);
}
