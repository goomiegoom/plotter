/* GENERATED from src/*.ts by scripts/build.mjs — do not edit. Rebuild with `npm run build`. */
"use strict";
var PlotterEngineBundle = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // src/index.ts
  var src_exports = {};
  __export(src_exports, {
    computeBrackets: () => computeBrackets,
    datasetFromParsed: () => datasetFromParsed,
    default: () => src_default,
    downloadTemplate: () => downloadTemplate,
    exportPng: () => exportPng,
    exportSvg: () => exportSvg,
    parseFile: () => parseFile,
    specFromState: () => specFromState,
    toReact: () => toReact
  });

  // src/stats.ts
  var stats_exports = {};
  __export(stats_exports, {
    LocalPostHocProvider: () => LocalPostHocProvider,
    adjustPValues: () => adjustPValues,
    cleanValues: () => cleanValues,
    describe: () => describe,
    erf: () => erf,
    errorValue: () => errorValue,
    fUpperTailP: () => fUpperTailP,
    formatP: () => formatP,
    incompleteBeta: () => incompleteBeta,
    logGamma: () => logGamma,
    mannWhitneyU: () => mannWhitneyU,
    mean: () => mean,
    normalCdf: () => normalCdf,
    oneWayANOVA: () => oneWayANOVA,
    pToSymbol: () => pToSymbol,
    pairedT: () => pairedT,
    runComparisons: () => runComparisons,
    sampleSD: () => sampleSD,
    setPostHocProvider: () => setPostHocProvider,
    studentTCdf: () => studentTCdf,
    studentTInv: () => studentTInv,
    studentTTwoTailedP: () => studentTTwoTailedP,
    unpairedT: () => unpairedT,
    welchT: () => welchT
  });
  function logGamma(x) {
    const c = [
      76.18009172947146,
      -86.50532032941678,
      24.01409824083091,
      -1.231739572450155,
      0.001208650973866179,
      -5395239384953e-18
    ];
    let y = x;
    let tmp = x + 5.5;
    tmp -= (x + 0.5) * Math.log(tmp);
    let ser = 1.000000000190015;
    for (let j = 0; j < 6; j++) {
      y += 1;
      ser += c[j] / y;
    }
    return -tmp + Math.log(2.5066282746310007 * ser / x);
  }
  function incompleteBeta(x, a, b) {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    const lbeta = logGamma(a + b) - logGamma(a) - logGamma(b) + a * Math.log(x) + b * Math.log(1 - x);
    const front = Math.exp(lbeta);
    if (x < (a + 1) / (a + b + 2)) {
      return front * betacf(x, a, b) / a;
    }
    return 1 - front * betacf(1 - x, b, a) / b;
  }
  function betacf(x, a, b) {
    const MAXIT = 200;
    const EPS = 3e-12;
    const FPMIN = 1e-300;
    const qab = a + b;
    const qap = a + 1;
    const qam = a - 1;
    let c = 1;
    let d = 1 - qab * x / qap;
    if (Math.abs(d) < FPMIN) d = FPMIN;
    d = 1 / d;
    let h = d;
    for (let m = 1; m <= MAXIT; m++) {
      const m2 = 2 * m;
      let aa = m * (b - m) * x / ((qam + m2) * (a + m2));
      d = 1 + aa * d;
      if (Math.abs(d) < FPMIN) d = FPMIN;
      c = 1 + aa / c;
      if (Math.abs(c) < FPMIN) c = FPMIN;
      d = 1 / d;
      h *= d * c;
      aa = -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2));
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
  function erf(x) {
    const sign = x < 0 ? -1 : 1;
    const ax = Math.abs(x);
    const t = 1 / (1 + 0.3275911 * ax);
    const y = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-ax * ax);
    return sign * y;
  }
  function normalCdf(z) {
    return 0.5 * (1 + erf(z / Math.SQRT2));
  }
  function studentTTwoTailedP(t, df) {
    if (!isFinite(t) || df <= 0) return NaN;
    const x = df / (df + t * t);
    return clampP(incompleteBeta(x, df / 2, 0.5));
  }
  function studentTCdf(t, df) {
    const p = 0.5 * incompleteBeta(df / (df + t * t), df / 2, 0.5);
    return t >= 0 ? 1 - p : p;
  }
  function studentTInv(p, df) {
    if (p <= 0) return -Infinity;
    if (p >= 1) return Infinity;
    let lo = -1e3;
    let hi = 1e3;
    for (let i = 0; i < 200; i++) {
      const mid = (lo + hi) / 2;
      if (studentTCdf(mid, df) < p) lo = mid;
      else hi = mid;
    }
    return (lo + hi) / 2;
  }
  function fUpperTailP(f, df1, df2) {
    if (df1 <= 0 || df2 <= 0 || Number.isNaN(f)) return NaN;
    if (f <= 0) return 1;
    const x = df1 * f / (df1 * f + df2);
    return clampP(1 - incompleteBeta(x, df1 / 2, df2 / 2));
  }
  function clampP(p) {
    if (!isFinite(p)) return p;
    return Math.min(1, Math.max(0, p));
  }
  function cleanValues(raw) {
    const arr = Array.isArray(raw) ? raw : String(raw).split(/[,\s]+/);
    return arr.map((v) => typeof v === "number" ? v : String(v).trim()).filter((v) => v !== "" && v !== null && v !== void 0).map(Number).filter((x) => !Number.isNaN(x) && Number.isFinite(x));
  }
  function mean(values) {
    if (!values.length) return 0;
    return values.reduce((s, x) => s + x, 0) / values.length;
  }
  function sampleSD(values) {
    const n = values.length;
    if (n < 2) return 0;
    const m = mean(values);
    const ss = values.reduce((s, x) => s + (x - m) * (x - m), 0);
    return Math.sqrt(ss / (n - 1));
  }
  function describe(raw) {
    const values = cleanValues(raw);
    const n = values.length;
    const m = mean(values);
    const sd = sampleSD(values);
    const sem = n > 1 ? sd / Math.sqrt(n) : 0;
    const ci95 = n > 1 ? studentTInv(0.975, n - 1) * sem : 0;
    return { n, mean: m, sd, sem, ci95, values };
  }
  function errorValue(stats, type) {
    if (type === "sd") return stats.sd;
    if (type === "ci") return stats.ci95;
    return stats.sem;
  }
  function unpairedT(a, b) {
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
  function welchT(a, b) {
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
    const df = (sa + sb) * (sa + sb) / (sa * sa / (na - 1) + sb * sb / (nb - 1));
    return { test: "welch", t, df, p: studentTTwoTailedP(t, df) };
  }
  function pairedT(a, b) {
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
  function variance(values) {
    const s = sampleSD(values);
    return s * s;
  }
  function mannWhitneyU(a, b) {
    const n1 = a.length;
    const n2 = b.length;
    const combined = [
      ...a.map((v) => ({ v, g: 0 })),
      ...b.map((v) => ({ v, g: 1 }))
    ].sort((p2, q) => p2.v - q.v);
    const n = n1 + n2;
    const ranks = new Array(n);
    const tieGroups = [];
    let i = 0;
    while (i < n) {
      let j = i;
      while (j < n - 1 && combined[j + 1].v === combined[i].v) j++;
      const avg = (i + j + 2) / 2;
      for (let k = i; k <= j; k++) ranks[k] = avg;
      if (j > i) tieGroups.push(j - i + 1);
      i = j + 1;
    }
    let r1 = 0;
    for (let k = 0; k < n; k++) if (combined[k].g === 0) r1 += ranks[k];
    const u1 = r1 - n1 * (n1 + 1) / 2;
    const u2 = n1 * n2 - u1;
    const U = Math.min(u1, u2);
    const hasTies = tieGroups.length > 0;
    const combos = choose(n1 + n2, n1);
    if (!hasTies && combos <= 6e4) {
      return { U, p: mannWhitneyExactP(n1, n2, U), method: "exact" };
    }
    const mu = n1 * n2 / 2;
    const tieTerm = tieGroups.reduce((s, t) => s + (t * t * t - t), 0);
    const sigma = Math.sqrt(
      n1 * n2 / 12 * (n + 1 - tieTerm / (n * (n - 1)))
    );
    if (sigma === 0) return { U, p: 1, method: "normal" };
    const z = (Math.abs(U - mu) - 0.5) / sigma;
    const p = clampP(2 * (1 - normalCdf(z)));
    return { U, p, method: "normal" };
  }
  function mannWhitneyExactP(n1, n2, Uobs) {
    const maxU = n1 * n2;
    const dp = [];
    for (let m = 0; m <= n1; m++) {
      dp[m] = [];
      for (let nn = 0; nn <= n2; nn++) {
        dp[m][nn] = new Array(m * nn + 1).fill(0);
      }
    }
    for (let m = 0; m <= n1; m++) dp[m][0][0] = 1;
    for (let nn = 0; nn <= n2; nn++) dp[0][nn][0] = 1;
    for (let m = 1; m <= n1; m++) {
      for (let nn = 1; nn <= n2; nn++) {
        const size = m * nn;
        for (let u = 0; u <= size; u++) {
          let val = dp[m][nn - 1][u] || 0;
          if (u - nn >= 0) val += dp[m - 1][nn][u - nn] || 0;
          dp[m][nn][u] = val;
        }
      }
    }
    const counts = dp[n1][n2];
    const total = counts.reduce((s, c) => s + c, 0);
    let le = 0;
    for (let u = 0; u <= Math.min(Uobs, maxU); u++) le += counts[u] || 0;
    return clampP(2 * le / total);
  }
  function choose(n, k) {
    if (k < 0 || k > n) return 0;
    k = Math.min(k, n - k);
    let r = 1;
    for (let i = 0; i < k; i++) r = r * (n - i) / (i + 1);
    return Math.round(r);
  }
  function oneWayANOVA(groups) {
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
  function pToSymbol(p) {
    if (!isFinite(p)) return "ns";
    if (p < 1e-4) return "****";
    if (p < 1e-3) return "***";
    if (p < 0.01) return "**";
    if (p < 0.05) return "*";
    return "ns";
  }
  function formatP(p) {
    if (!isFinite(p)) return "n/a";
    if (p < 1e-4) return "p<0.0001";
    return "p=" + p.toPrecision(2).replace(/\.?0+$/, "");
  }
  function adjustPValues(pRaw, method) {
    const m = pRaw.length;
    if (m === 0) return [];
    if (method === "none") return pRaw.map((p) => clampP(p));
    if (method === "bonferroni") return pRaw.map((p) => clampP(p * m));
    const order = pRaw.map((p, i) => ({ p, i })).sort((a, b) => a.p - b.p);
    const adj = new Array(m);
    let running = 0;
    for (let rank = 0; rank < m; rank++) {
      const { p, i } = order[rank];
      const k = m - rank;
      let a = 1 - Math.pow(1 - clampP(p), k);
      a = Math.max(a, running);
      running = a;
      adj[i] = clampP(a);
    }
    return adj;
  }
  function buildPairs(groups, opts) {
    var _a, _b;
    const n = groups.length;
    if (opts.mode === "manual") {
      return ((_a = opts.pairs) != null ? _a : []).filter(
        ([a, b]) => a !== b && a >= 0 && b >= 0 && a < n && b < n
      );
    }
    if (opts.mode === "control") {
      const c = (_b = opts.controlIndex) != null ? _b : 0;
      const pairs2 = [];
      for (let i = 0; i < n; i++) if (i !== c) pairs2.push([c, i]);
      return pairs2;
    }
    const pairs = [];
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) pairs.push([i, j]);
    return pairs;
  }
  function runOneTest(a, b, opts) {
    var _a;
    if (opts.family === "nonparam") {
      const r2 = mannWhitneyU(a, b);
      return { test: "mann-whitney", statistic: r2.U, p: r2.p };
    }
    const kind = (_a = opts.parametric) != null ? _a : "welch";
    const r = kind === "student" ? unpairedT(a, b) : kind === "paired" ? pairedT(a, b) : welchT(a, b);
    return { test: r.test, statistic: r.t, df: r.df, p: r.p };
  }
  var LocalPostHocProvider = class {
    runComparisons(groups, opts) {
      const pairs = buildPairs(groups, opts);
      const raw = pairs.map(
        ([ai, bi]) => runOneTest(groups[ai].values, groups[bi].values, opts)
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
          symbol: pToSymbol(pAdjusted)
        };
      });
    }
  };
  var activeProvider = new LocalPostHocProvider();
  function setPostHocProvider(provider) {
    activeProvider = provider;
  }
  function runComparisons(groups, opts) {
    return activeProvider.runComparisons(groups, opts);
  }

  // src/parse.ts
  var parse_exports = {};
  __export(parse_exports, {
    ParseError: () => ParseError,
    detectShape: () => detectShape,
    groupPrefix: () => groupPrefix,
    parseLong: () => parseLong,
    parseRows: () => parseRows,
    parseWide: () => parseWide,
    parseWorkbook: () => parseWorkbook,
    readWorkbookRows: () => readWorkbookRows,
    templateRows: () => templateRows,
    toCsv: () => toCsv
  });
  var ParseError = class extends Error {
  };
  function readWorkbookRows(data, XLSX) {
    const wb = XLSX.read(data, { type: "array" });
    const first = wb.SheetNames[0];
    if (!first) throw new ParseError("The file has no sheets.");
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[first], {
      header: 1,
      raw: false,
      defval: "",
      blankrows: false
    });
    return rows.map((r) => r.map((c) => c == null ? "" : String(c).trim()));
  }
  var isBlank = (s) => s == null || String(s).trim() === "";
  var isNumeric = (s) => !isBlank(s) && !Number.isNaN(Number(s));
  function stripEmptyTrailingCols(rows) {
    const width = rows.reduce((w, r) => Math.max(w, r.length), 0);
    let last = width;
    while (last > 0 && rows.every((r) => {
      var _a;
      return isBlank((_a = r[last - 1]) != null ? _a : "");
    })) last--;
    return rows.map((r) => {
      const out = r.slice(0, last);
      while (out.length < last) out.push("");
      return out;
    });
  }
  function detectShape(rows) {
    var _a;
    const clean = stripEmptyTrailingCols(rows.filter((r) => r.some((c) => !isBlank(c))));
    if (clean.length === 0) throw new ParseError("The sheet is empty.");
    const header = clean[0];
    const ncols = header.length;
    if (ncols === 3) {
      const h = header.map((s) => s.toLowerCase());
      const headerLooksLong = /group|cond|treat|series/.test(h[0]) && /value|val|measure|y|response|result/.test(h[2]);
      if (headerLooksLong) return "long";
      const body = clean.slice(1);
      if (body.length >= 2) {
        const col0 = body.map((r) => r[0]);
        const distinct = new Set(col0).size;
        const valuesNumeric = body.every((r) => isBlank(r[2]) || isNumeric(r[2]));
        if (distinct < col0.length && valuesNumeric) return "long";
      }
    }
    const prefixes = header.slice(1).map(groupPrefix);
    const counts = /* @__PURE__ */ new Map();
    for (const p of prefixes) counts.set(p, ((_a = counts.get(p)) != null ? _a : 0) + 1);
    if ([...counts.values()].some((c) => c >= 2)) return "wide";
    return ncols === 3 ? "long" : "wide";
  }
  function groupPrefix(header) {
    const h = header.trim();
    const m = h.match(/^(.*?)[\s._-]*\d+$/);
    return (m ? m[1] : h).trim() || h;
  }
  function uniqueInOrder(items) {
    const seen = /* @__PURE__ */ new Set();
    const out = [];
    for (const it of items) {
      if (!seen.has(it)) {
        seen.add(it);
        out.push(it);
      }
    }
    return out;
  }
  function parseLong(rows) {
    const clean = stripEmptyTrailingCols(rows.filter((r) => r.some((c) => !isBlank(c))));
    if (clean.length < 2) throw new ParseError("LONG format needs a header row plus at least one data row.");
    const header = clean[0];
    if (header.length < 3) {
      throw new ParseError("LONG format needs 3 columns: Group, X, Value.");
    }
    const body = clean.slice(1);
    const warnings = [];
    body.forEach((r, i) => {
      if (r.length < 3) {
        throw new ParseError(`Row ${i + 2} is ragged \u2014 expected 3 columns (Group, X, Value).`);
      }
      if (!isBlank(r[2]) && !isNumeric(r[2])) {
        throw new ParseError(`Non-numeric value "${r[2]}" in row ${i + 2}, column "${header[2] || "Value"}".`);
      }
    });
    const groupNames = uniqueInOrder(body.map((r) => r[0]).filter((s) => !isBlank(s)));
    const xLabels = uniqueInOrder(body.map((r) => r[1]).filter((s) => !isBlank(s)));
    const gi = new Map(groupNames.map((g, i) => [g, i]));
    const xi = new Map(xLabels.map((x, i) => [x, i]));
    const cells = groupNames.map(() => xLabels.map(() => []));
    for (const r of body) {
      if (isBlank(r[0]) || isBlank(r[1]) || isBlank(r[2])) continue;
      cells[gi.get(r[0])][xi.get(r[1])].push(r[2]);
    }
    return { shape: "long", xLabels, groupNames, cells, warnings };
  }
  function parseWide(rows) {
    const clean = stripEmptyTrailingCols(rows.filter((r) => r.some((c) => !isBlank(c))));
    if (clean.length < 2) throw new ParseError("WIDE format needs a header row plus at least one data row.");
    const header = clean[0];
    if (header.length < 2) {
      throw new ParseError("WIDE format needs an X column plus at least one value column.");
    }
    const body = clean.slice(1);
    const warnings = [];
    const colGroup = header.slice(1).map(groupPrefix);
    const groupNames = uniqueInOrder(colGroup);
    const gi = new Map(groupNames.map((g, i) => [g, i]));
    const xLabels = [];
    const cells = groupNames.map(() => []);
    groupNames.forEach((_, g) => cells[g] = []);
    body.forEach((r, ri) => {
      var _a;
      const x = r[0];
      if (isBlank(x)) return;
      const xIndex = xLabels.length;
      xLabels.push(x);
      groupNames.forEach((_, g) => cells[g].push([]));
      for (let c = 1; c < header.length; c++) {
        const val = (_a = r[c]) != null ? _a : "";
        if (isBlank(val)) continue;
        if (!isNumeric(val)) {
          throw new ParseError(`Non-numeric value "${val}" in row ${ri + 2}, column "${header[c]}".`);
        }
        const g = gi.get(colGroup[c - 1]);
        cells[g][xIndex].push(val);
      }
    });
    if (xLabels.length === 0) throw new ParseError("WIDE format: no data rows with an X value.");
    return { shape: "wide", xLabels, groupNames, cells, warnings };
  }
  function parseRows(rows, shape) {
    const s = shape != null ? shape : detectShape(rows);
    const data = s === "long" ? parseLong(rows) : parseWide(rows);
    if (shape && shape !== detectShapeSafe(rows)) {
      data.warnings.push(`Parsed as ${s.toUpperCase()} (manual override).`);
    }
    if (data.groupNames.length === 0) throw new ParseError("No groups found.");
    return data;
  }
  function detectShapeSafe(rows) {
    try {
      return detectShape(rows);
    } catch {
      return null;
    }
  }
  function parseWorkbook(data, XLSX, shape) {
    return parseRows(readWorkbookRows(data, XLSX), shape);
  }
  function templateRows(shape) {
    if (shape === "long") {
      return [
        ["Group", "X", "Value"],
        ["Control", "0", "18"],
        ["Control", "0", "20"],
        ["Control", "0", "22"],
        ["Control", "24", "32"],
        ["Control", "24", "34"],
        ["Control", "24", "36"],
        ["Drug A", "0", "20"],
        ["Drug A", "0", "22"],
        ["Drug A", "0", "24"],
        ["Drug A", "24", "27"],
        ["Drug A", "24", "29"],
        ["Drug A", "24", "31"]
      ];
    }
    return [
      ["X", "Control_1", "Control_2", "Control_3", "Drug A_1", "Drug A_2", "Drug A_3"],
      ["0", "18", "20", "22", "20", "22", "24"],
      ["24", "32", "34", "36", "27", "29", "31"],
      ["48", "45", "47", "49", "35", "37", "39"],
      ["72", "52", "54", "56", "40", "42", "44"]
    ];
  }
  function toCsv(rows) {
    return rows.map(
      (r) => r.map((c) => /[",\n]/.test(c) ? '"' + c.replace(/"/g, '""') + '"' : c).join(",")
    ).join("\n");
  }

  // src/plot.ts
  var plot_exports = {};
  __export(plot_exports, {
    DEFAULT_BRACKET_CONFIG: () => DEFAULT_BRACKET_CONFIG,
    assignBracketLevels: () => assignBracketLevels,
    buildScene: () => buildScene,
    dpiScale: () => dpiScale,
    el: () => el,
    fileStem: () => fileStem,
    mmToPx: () => mmToPx,
    serializeEl: () => serializeEl,
    serializeSvg: () => serializeSvg
  });
  function el(tag, attrs = {}, ...children) {
    const clean = {};
    for (const [k, v] of Object.entries(attrs)) if (v !== void 0) clean[k] = v;
    return {
      tag,
      attrs: clean,
      children: children.filter((c) => c != null)
    };
  }
  var INK = "#1f2733";
  var FONT = "Helvetica, Arial, sans-serif";
  var AXIS_W = 1.5;
  var TICK_LEN = 6;
  var MARKER_R = 3.5;
  var LINE_W = 2;
  var DEFAULT_BRACKET_CONFIG = { height: 22, gap: 14, cap: 6 };
  function assignBracketLevels(spans) {
    var _a, _b;
    const order = spans.map((s, i) => ({ lo: Math.min(s[0], s[1]), hi: Math.max(s[0], s[1]), i })).sort((a, b) => a.hi - a.lo - (b.hi - b.lo) || a.lo - b.lo);
    const levelRanges = [];
    const levels = new Array(spans.length).fill(0);
    for (const s of order) {
      let lvl = 0;
      for (; ; ) {
        const occupied = (_a = levelRanges[lvl]) != null ? _a : [];
        const clash = occupied.some(([lo, hi]) => s.lo <= hi && lo <= s.hi);
        if (!clash) {
          ((_b = levelRanges[lvl]) != null ? _b : levelRanges[lvl] = []).push([s.lo, s.hi]);
          levels[s.i] = lvl;
          break;
        }
        lvl++;
      }
    }
    return levels;
  }
  function mmToPx(mm) {
    return mm / 25.4 * 96;
  }
  function dpiScale(dpi) {
    return dpi / 96;
  }
  function fileStem(title, fallback = "plot") {
    const s = (title || "").trim().replace(/[^\w\- ]+/g, "").replace(/\s+/g, "_");
    return s || fallback;
  }
  var PLOT = 416;
  var X0 = 96;
  var Y0 = 46;
  function dataMaxMin(spec) {
    let dmax = -Infinity;
    let dmin = Infinity;
    const consider = (v) => {
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
  function buildScene(spec) {
    var _a, _b, _c;
    const isLine = spec.plotType === "line";
    const isBar = spec.plotType === "bar";
    const isViolin = spec.plotType === "violin";
    const outside = spec.legendPos === "outside-right";
    const cfg = (_a = spec.bracketConfig) != null ? _a : DEFAULT_BRACKET_CONFIG;
    const X1 = X0 + PLOT;
    const Y1 = Y0 + PLOT;
    const W = PLOT;
    const H = PLOT;
    const SVGW = outside ? X1 + 172 : X1 + 44;
    const SVGH = Y1 + 60;
    const { dmax, dmin } = dataMaxMin(spec);
    let bottom;
    let top;
    if (spec.yLog) {
      const posMin = dmin > 0 ? dmin : dmax > 0 ? dmax / 100 : 0.1;
      bottom = spec.yAuto ? Math.pow(10, Math.floor(Math.log10(posMin))) : Math.max(1e-9, spec.yMin);
      top = spec.yAuto ? Math.pow(10, Math.ceil(Math.log10(dmax * 1.05))) : spec.yMax;
      if (top <= bottom) top = bottom * 10;
    } else if (spec.yAuto) {
      bottom = Math.min(0, dmin);
      top = Math.max(bottom + 1, Math.ceil(dmax * 1.12 / 20) * 20 || 20);
    } else {
      bottom = spec.yMin;
      top = spec.yMax;
      if (top <= bottom) top = bottom + 20;
    }
    const yToPx = (v) => {
      if (spec.yLog) {
        const lv = Math.log10(Math.max(v, 1e-12));
        const lb = Math.log10(bottom);
        const lt = Math.log10(top);
        return Y1 - (lv - lb) / (lt - lb) * H;
      }
      return Y1 - (v - bottom) / (top - bottom) * H;
    };
    const nCat = isLine ? spec.xLabels.length : spec.series.length;
    const xCat = (i) => X0 + W * ((i + 0.5) / Math.max(1, nCat));
    const xNums = (_c = (_b = spec.series[0]) == null ? void 0 : _b.points.map((p) => p.xNum)) != null ? _c : [];
    const xNumMin = Math.min(...xNums.length ? xNums : [0]);
    const xNumMax = Math.max(...xNums.length ? xNums : [1]);
    const xLineNumeric = (xn) => {
      if (spec.xLog) {
        const a = Math.log10(Math.max(xn, 1e-12));
        const lo = Math.log10(Math.max(xNumMin, 1e-12));
        const hi = Math.log10(Math.max(xNumMax, 1e-12));
        return X0 + (hi === lo ? W / 2 : (a - lo) / (hi - lo) * W);
      }
      return X0 + (xNumMax === xNumMin ? W / 2 : (xn - xNumMin) / (xNumMax - xNumMin) * W);
    };
    const xLineCat = (i, n) => X0 + (n <= 1 ? W / 2 : W * (i / (n - 1)));
    const lineX = (p, i, n) => spec.xAxisType === "numeric" ? xLineNumeric(p.xNum) : xLineCat(i, n);
    const kids = [];
    if (spec.plotTitle) {
      kids.push(
        el("text", { x: (X0 + X1) / 2, y: 28, "text-anchor": "middle", "font-size": 16, "font-weight": 700, "font-family": FONT, fill: INK }, spec.plotTitle)
      );
    }
    const tickVals = [];
    if (spec.yLog) {
      const lo = Math.floor(Math.log10(bottom));
      const hi = Math.ceil(Math.log10(top));
      for (let e = lo; e <= hi; e++) tickVals.push(Math.pow(10, e));
    } else {
      const nTicks = 5;
      for (let i = 0; i <= nTicks; i++) tickVals.push(bottom + (top - bottom) * i / nTicks);
    }
    if (spec.gridlines) {
      tickVals.forEach(
        (v, i) => kids.push(el("line", { key: "grid" + i, x1: X0, y1: yToPx(v), x2: X1, y2: yToPx(v), stroke: "#eceff3", "stroke-width": 1 }))
      );
    }
    kids.push(el("line", { x1: X0, y1: Y0 - 4, x2: X0, y2: Y1, stroke: INK, "stroke-width": AXIS_W }));
    kids.push(el("line", { x1: X0, y1: Y1, x2: X1 + 4, y2: Y1, stroke: INK, "stroke-width": AXIS_W }));
    tickVals.forEach((v) => {
      kids.push(el("line", { x1: X0 - TICK_LEN, y1: yToPx(v), x2: X0, y2: yToPx(v), stroke: INK, "stroke-width": AXIS_W }));
      kids.push(
        el("text", { x: X0 - TICK_LEN - 4, y: yToPx(v) + 4, "text-anchor": "end", "font-size": 13, "font-family": FONT, fill: INK }, fmtTick(v, spec.yLog))
      );
    });
    const xTickLabels = isLine ? spec.xLabels : spec.series.map((s) => s.name);
    const xTickPos = (i) => {
      var _a2, _b2;
      return isLine ? lineX((_b2 = (_a2 = spec.series[0]) == null ? void 0 : _a2.points[i]) != null ? _b2 : { xNum: i }, i, nCat) : xCat(i);
    };
    xTickLabels.forEach((lab, i) => {
      const cx = xTickPos(i);
      kids.push(el("line", { x1: cx, y1: Y1, x2: cx, y2: Y1 + TICK_LEN, stroke: INK, "stroke-width": AXIS_W }));
      kids.push(el("text", { x: cx, y: Y1 + 20, "text-anchor": "middle", "font-size": 13, "font-family": FONT, fill: INK }, lab));
    });
    kids.push(el("text", { x: (X0 + X1) / 2, y: Y1 + 44, "text-anchor": "middle", "font-size": 14, "font-weight": 600, "font-family": FONT, fill: INK }, spec.xTitle));
    const ymid = (Y0 + Y1) / 2;
    kids.push(el("text", { x: 24, y: ymid, "text-anchor": "middle", "font-size": 14, "font-weight": 600, "font-family": FONT, fill: INK, transform: `rotate(-90 24 ${ymid})` }, spec.yTitle));
    const markerEl = (cx, cy, shape, color, sz = MARKER_R) => {
      if (shape === "square") return el("rect", { x: cx - sz, y: cy - sz, width: sz * 2, height: sz * 2, fill: color, stroke: "#fff", "stroke-width": 0.8 });
      if (shape === "triangle") return el("polygon", { points: `${cx},${cy - sz * 1.15} ${cx + sz * 1.1},${cy + sz} ${cx - sz * 1.1},${cy + sz}`, fill: color, stroke: "#fff", "stroke-width": 0.8 });
      if (shape === "diamond") return el("polygon", { points: `${cx},${cy - sz * 1.25} ${cx + sz * 1.1},${cy} ${cx},${cy + sz * 1.25} ${cx - sz * 1.1},${cy}`, fill: color, stroke: "#fff", "stroke-width": 0.8 });
      return el("circle", { cx, cy, r: sz, fill: color, stroke: "#fff", "stroke-width": 0.8 });
    };
    const ebar = (cx, m, e, color) => {
      if (!(e > 0)) return null;
      return el(
        "g",
        { stroke: color, "stroke-width": AXIS_W },
        el("line", { x1: cx, y1: yToPx(m + e), x2: cx, y2: yToPx(m - e) }),
        el("line", { x1: cx - 4, y1: yToPx(m + e), x2: cx + 4, y2: yToPx(m + e) }),
        el("line", { x1: cx - 4, y1: yToPx(m - e), x2: cx + 4, y2: yToPx(m - e) })
      );
    };
    const jitter = (k) => (Math.sin(k * 12.9898) * 43758.5453 % 1 + 1) % 1;
    if (isLine) {
      spec.series.forEach((s) => {
        const pts = s.points.map((p, i) => ({ cx: lineX(p, i, nCat), m: p.mean, e: p.err }));
        const d = pts.map((p, i) => (i === 0 ? "M" : "L") + p.cx + " " + yToPx(p.m)).join(" ");
        kids.push(el("path", { d, fill: "none", stroke: s.color, "stroke-width": LINE_W, "stroke-dasharray": s.line === "dashed" ? "6 4" : "none", "stroke-linejoin": "round" }));
        pts.forEach((p) => {
          const e = ebar(p.cx, p.m, p.e, s.color);
          if (e) kids.push(e);
        });
        pts.forEach((p) => kids.push(markerEl(p.cx, yToPx(p.m), s.marker, s.color)));
      });
    }
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
          s.agg.values.forEach(
            (v, k) => kids.push(el("circle", { cx: cx + (jitter(gi * 7 + k) - 0.5) * bw * 0.55, cy: yToPx(v), r: 2.2, fill: INK, "fill-opacity": 0.55 }))
          );
        }
      });
    }
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
        const profile = [];
        let peak = 1e-9;
        for (let k = 0; k <= N; k++) {
          const v = lo + (hi - lo) * k / N;
          const dens = kde(v, vals, bw);
          profile.push([v, dens]);
          if (dens > peak) peak = dens;
        }
        let d = "";
        profile.forEach((p, k) => {
          d += (k === 0 ? "M" : "L") + (cx - p[1] / peak * halfW) + " " + yToPx(p[0]) + " ";
        });
        for (let k = profile.length - 1; k >= 0; k--) d += "L" + (cx + profile[k][1] / peak * halfW) + " " + yToPx(profile[k][0]) + " ";
        d += "Z";
        kids.push(el("path", { d, fill: s.color, "fill-opacity": 0.32, stroke: s.color, "stroke-width": 1.6, "stroke-linejoin": "round" }));
        if (spec.showPoints) {
          vals.forEach(
            (v, k) => kids.push(el("circle", { cx: cx + (jitter(gi * 5 + k) - 0.5) * halfW * 0.7, cy: yToPx(v), r: 2.2, fill: s.color, "fill-opacity": 0.85 }))
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
    if (spec.showSig && spec.brackets.length) {
      if (isLine && spec.compareAtEachX) {
        kids.push(...buildPerXMarkers(spec, lineX, yToPx, nCat));
      } else if (isLine) {
        kids.push(...buildSeriesAnnotations(spec, X0, Y0));
      } else {
        kids.push(...buildHorizontalBrackets(spec, xCat, yToPx, cfg, Y0));
      }
    }
    if (spec.legendPos !== "none") {
      const lx = outside ? X1 + 22 : X1 - 132;
      const ly0 = Y0 + 6;
      spec.series.forEach((s, gi) => {
        const y = ly0 + gi * 20;
        const entry = [];
        if (isLine) {
          entry.push(el("line", { x1: lx, y1: y, x2: lx + 22, y2: y, stroke: s.color, "stroke-width": LINE_W, "stroke-dasharray": s.line === "dashed" ? "5 4" : "none" }));
          entry.push(markerEl(lx + 11, y, s.marker, s.color, 3.5));
        } else {
          entry.push(el("rect", { x: lx + 2, y: y - 6, width: 16, height: 12, fill: s.color, "fill-opacity": isViolin ? 0.5 : 0.92, stroke: s.color, "stroke-width": 1 }));
        }
        entry.push(el("text", { x: lx + 28, y: y + 4, "text-anchor": "start", "font-size": 13, "font-family": FONT, fill: INK }, s.name));
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
  function buildHorizontalBrackets(spec, xCat, yToPx, cfg, Y02) {
    const spans = spec.brackets.map((b) => [b.aIndex, b.bIndex]);
    const levels = assignBracketLevels(spans);
    const out = [];
    spec.brackets.forEach((b, idx) => {
      const xi = xCat(b.aIndex);
      const xj = xCat(b.bIndex);
      const topData = Math.min(
        seriesTopPx(spec, b.aIndex, yToPx),
        seriesTopPx(spec, b.bIndex, yToPx)
      );
      const yb = Math.min(topData, Y02 + 4) - cfg.gap - levels[idx] * cfg.height;
      out.push(bracketEl(xi, xj, yb, cfg.cap, b.label, b.isNs));
    });
    return out;
  }
  function seriesTopPx(spec, i, yToPx) {
    const s = spec.series[i];
    if (!s) return Infinity;
    const top = s.agg.mean + s.agg.err;
    const maxVal = s.agg.values.length ? Math.max(...s.agg.values) : top;
    return yToPx(Math.max(top, maxVal));
  }
  function bracketEl(xi, xj, yb, cap, label, isNs) {
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
  function buildPerXMarkers(spec, lineX, yToPx, nCat) {
    var _a, _b, _c;
    const out = [];
    const byX = /* @__PURE__ */ new Map();
    for (const b of spec.brackets) {
      const xi = (_a = b.xIndex) != null ? _a : 0;
      ((_b = byX.get(xi)) != null ? _b : byX.set(xi, []).get(xi)).push(b);
    }
    for (const [xi, list] of byX) {
      const p0 = (_c = spec.series[0]) == null ? void 0 : _c.points[xi];
      if (!p0) continue;
      const cx = lineX(p0, xi, nCat);
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
  function buildSeriesAnnotations(spec, X02, Y02) {
    const out = [];
    spec.brackets.forEach((b, i) => {
      var _a, _b, _c, _d;
      const a = (_b = (_a = spec.series[b.aIndex]) == null ? void 0 : _a.name) != null ? _b : "?";
      const bb = (_d = (_c = spec.series[b.bIndex]) == null ? void 0 : _c.name) != null ? _d : "?";
      out.push(
        el("text", { x: X02 + 8, y: Y02 + 12 + i * 16, "text-anchor": "start", "font-size": 12, "font-family": FONT, fill: b.isNs ? "#6b7280" : INK }, `${a} vs ${bb}: ${b.label}`)
      );
    });
    return out;
  }
  function silvermanBandwidth(values, sd) {
    const n = values.length;
    if (n < 2) return Math.max(sd, 1) || 1;
    const h = 1.06 * (sd || 1) * Math.pow(n, -1 / 5);
    return h > 0 ? h : 1;
  }
  function kde(x, values, bw) {
    if (!values.length || bw <= 0) return 0;
    let s = 0;
    for (const v of values) {
      const u = (x - v) / bw;
      s += Math.exp(-0.5 * u * u);
    }
    return s / (values.length * bw * Math.sqrt(2 * Math.PI));
  }
  function quantile(sorted, q) {
    if (!sorted.length) return 0;
    const pos = (sorted.length - 1) * q;
    const base = Math.floor(pos);
    const rest = pos - base;
    return sorted[base + 1] !== void 0 ? sorted[base] + rest * (sorted[base + 1] - sorted[base]) : sorted[base];
  }
  function fmtTick(v, log) {
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
  var VOID_TAGS = /* @__PURE__ */ new Set(["line", "rect", "circle", "polygon", "path"]);
  function escapeAttr(v) {
    return v.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
  }
  function escapeText(v) {
    return v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }
  function serializeEl(node) {
    if (typeof node === "string") return escapeText(node);
    const attrs = Object.entries(node.attrs).filter(([k]) => k !== "key").map(([k, v]) => `${k}="${escapeAttr(String(v))}"`).join(" ");
    const open = attrs ? `<${node.tag} ${attrs}>` : `<${node.tag}>`;
    if (node.children.length === 0 && VOID_TAGS.has(node.tag)) {
      return attrs ? `<${node.tag} ${attrs}/>` : `<${node.tag}/>`;
    }
    const inner = node.children.map(serializeEl).join("");
    return `${open}${inner}</${node.tag}>`;
  }
  function serializeSvg(scene) {
    return `<?xml version="1.0" encoding="UTF-8"?>
` + serializeEl(scene.root);
  }

  // src/index.ts
  function aggregate(cells, gi, errorType) {
    var _a;
    const values = [];
    for (const col of (_a = cells[gi]) != null ? _a : []) values.push(...cleanValues(col));
    const s = describe(values);
    return { mean: s.mean, err: errorValue(s, errorType), sd: s.sd, n: s.n, values: s.values };
  }
  function buildSeries(S) {
    return S.groups.map((g, gi) => {
      const points = S.xLabels.map((lab, xi) => {
        var _a, _b;
        const st = describe((_b = (_a = S.cells[gi]) == null ? void 0 : _a[xi]) != null ? _b : []);
        return {
          xLabel: lab,
          xNum: Number(lab),
          mean: st.mean,
          err: errorValue(st, S.errorType),
          n: st.n,
          values: st.values
        };
      });
      return {
        name: g.name,
        color: g.color,
        marker: g.marker,
        line: g.line,
        points,
        agg: aggregate(S.cells, gi, S.errorType)
      };
    });
  }
  function groupValues(S, xIndex) {
    return S.groups.map((g, gi) => {
      var _a, _b, _c;
      let values;
      if (xIndex == null) {
        values = [];
        for (const col of (_a = S.cells[gi]) != null ? _a : []) values.push(...cleanValues(col));
      } else {
        values = cleanValues((_c = (_b = S.cells[gi]) == null ? void 0 : _b[xIndex]) != null ? _c : []);
      }
      return { index: gi, name: g.name, values };
    });
  }
  function comparisonOptions(S) {
    return {
      family: S.testFamily,
      parametric: "welch",
      mode: S.compMode,
      controlIndex: S.controlGroup,
      pairs: S.manualPairs,
      correction: S.correction,
      display: S.sigDisplay
    };
  }
  function bracketLabel(c, display) {
    const isNs = c.symbol === "ns";
    if (display === "pvalue") return { label: formatP(c.pAdjusted), isNs };
    if (display === "ns") return { label: c.symbol, isNs };
    return { label: c.symbol, isNs };
  }
  function computeBrackets(S) {
    const warnings = [];
    if (!S.showSig || S.groups.length < 2) return { brackets: [], comparisons: [], warnings };
    if (S.plotType === "violin") {
      const small = S.groups.some((_, gi) => aggregate(S.cells, gi, S.errorType).n < 10);
      if (small) warnings.push("Some groups have n < 10 \u2014 a bar chart with individual points is usually clearer than a violin.");
    }
    if (S.plotType === "line" && S.compareAtEachX) {
      const all = [];
      const brackets2 = [];
      S.xLabels.forEach((_, xi) => {
        const cs = runComparisons(groupValues(S, xi), comparisonOptions(S));
        cs.forEach((c) => {
          all.push({ ...c, xIndex: xi });
          const { label, isNs } = bracketLabel(c, S.sigDisplay);
          brackets2.push({ aIndex: c.groupA, bIndex: c.groupB, label, isNs, xIndex: xi });
        });
      });
      return { brackets: brackets2, comparisons: all, warnings };
    }
    const comparisons = runComparisons(groupValues(S), comparisonOptions(S));
    const brackets = comparisons.map((c) => {
      const { label, isNs } = bracketLabel(c, S.sigDisplay);
      return { aIndex: c.groupA, bIndex: c.groupB, label, isNs };
    });
    return { brackets, comparisons, warnings };
  }
  function specFromState(S) {
    const { brackets, comparisons, warnings } = computeBrackets(S);
    const spec = {
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
      brackets
    };
    return { spec, comparisons, warnings };
  }
  var ATTR_RENAME = {
    "font-size": "fontSize",
    "font-weight": "fontWeight",
    "font-style": "fontStyle",
    "font-family": "fontFamily",
    "text-anchor": "textAnchor",
    "stroke-width": "strokeWidth",
    "stroke-dasharray": "strokeDasharray",
    "stroke-linejoin": "strokeLinejoin",
    "fill-opacity": "fillOpacity"
  };
  function toReact(React, node, key, decorate) {
    var _a;
    if (typeof node === "string") return node;
    const props = { key };
    for (const [k, v] of Object.entries(node.attrs)) {
      if (k === "key") continue;
      const name = (_a = ATTR_RENAME[k]) != null ? _a : k;
      props[name] = v;
    }
    const extra = decorate ? decorate(node) : null;
    if (extra) Object.assign(props, extra);
    const children = node.children.map((c, i) => toReact(React, c, i, decorate));
    return React.createElement(node.tag, props, ...children);
  }
  function getXLSX() {
    const X = globalThis.XLSX;
    if (!X) throw new ParseError("Spreadsheet library not loaded yet \u2014 please retry in a moment.");
    return X;
  }
  async function parseFile(file, shape) {
    const buf = await file.arrayBuffer();
    if (/\.csv$/i.test(file.name)) {
      const text = new TextDecoder().decode(buf);
      return parseRows(csvToRows(text), shape);
    }
    return parseWorkbook(buf, getXLSX(), shape);
  }
  function csvToRows(text) {
    const rows = [];
    let row = [];
    let field = "";
    let inQuotes = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (inQuotes) {
        if (c === '"') {
          if (text[i + 1] === '"') {
            field += '"';
            i++;
          } else inQuotes = false;
        } else field += c;
      } else if (c === '"') inQuotes = true;
      else if (c === ",") {
        row.push(field);
        field = "";
      } else if (c === "\n") {
        row.push(field);
        rows.push(row);
        row = [];
        field = "";
      } else if (c === "\r") {
      } else field += c;
    }
    if (field !== "" || row.length) {
      row.push(field);
      rows.push(row);
    }
    return rows.map((r) => r.map((s) => s.trim()));
  }
  function triggerDownload(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1e3);
  }
  function downloadTemplate(shape = "long") {
    const XLSX = getXLSX();
    const ws = XLSX.utils.aoa_to_sheet(templateRows(shape));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "data");
    const out = XLSX.write(wb, { type: "array", bookType: "xlsx" });
    triggerDownload(new Blob([out], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), `plotter-template-${shape}.xlsx`);
  }
  function exportSvg(scene, title) {
    const svg = serializeSvg(scene);
    triggerDownload(new Blob([svg], { type: "image/svg+xml" }), `${fileStem(title)}.svg`);
  }
  function exportPng(scene, opts) {
    const svg = serializeSvg(scene);
    const scale = dpiScale(opts.dpi);
    const pxW = Math.round(mmToPx(opts.widthMm) * scale);
    const pxH = Math.round(mmToPx(opts.heightMm) * scale);
    return new Promise((resolve, reject) => {
      const img = new Image();
      const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = pxW;
        canvas.height = pxH;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Canvas unsupported"));
          return;
        }
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, pxW, pxH);
        ctx.drawImage(img, 0, 0, pxW, pxH);
        URL.revokeObjectURL(url);
        canvas.toBlob((b) => {
          if (b) {
            triggerDownload(b, `${fileStem(opts.title)}_${opts.dpi}dpi.png`);
            resolve();
          } else reject(new Error("PNG encode failed"));
        }, "image/png");
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error("SVG render failed"));
      };
      img.src = url;
    });
  }
  function datasetFromParsed(parsed) {
    return {
      xLabels: parsed.xLabels,
      groups: parsed.groupNames.map((name) => ({ name, color: "", marker: "circle", line: "solid" })),
      cells: parsed.cells
    };
  }
  var PlotterEngine = {
    stats: stats_exports,
    parse: parse_exports,
    plot: plot_exports,
    specFromState,
    computeBrackets,
    buildScene,
    toReact,
    serializeSvg,
    parseFile,
    downloadTemplate,
    exportSvg,
    exportPng,
    datasetFromParsed
  };
  globalThis.PlotterEngine = PlotterEngine;
  var src_default = PlotterEngine;
  return __toCommonJS(src_exports);
})();
