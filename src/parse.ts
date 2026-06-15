/**
 * Parsing module — turn an uploaded spreadsheet (or a pasted grid) into the
 * canonical {@link ParsedData} the UI consumes.
 *
 * Two input shapes are supported:
 *   LONG  columns [Group, X, Value]; multiple rows = replicates.
 *   WIDE  first column = X, then replicate columns grouped per group
 *         (GroupA_1, GroupA_2, GroupB_1, ...).
 *
 * The SheetJS (xlsx) dependency is *injected* — the binary read happens in
 * {@link readWorkbookRows}, which takes the `XLSX` object (loaded from a CDN in
 * the browser, `window.XLSX`). Everything below `readWorkbookRows` operates on
 * a plain `string[][]` grid, so the detection / normalization / validation
 * logic is fully unit-testable without the dependency or the DOM.
 */

export type Shape = "long" | "wide";

export interface ParsedData {
  shape: Shape;
  xLabels: string[];
  groupNames: string[];
  /** cells[groupIndex][xIndex] = replicate value strings */
  cells: string[][][];
  warnings: string[];
}

export class ParseError extends Error {}

/** Minimal structural typing for the bit of SheetJS we use. */
export interface XlsxLike {
  read(data: ArrayBuffer | Uint8Array, opts: { type: string }): {
    SheetNames: string[];
    Sheets: Record<string, unknown>;
  };
  utils: {
    sheet_to_json(sheet: unknown, opts: Record<string, unknown>): unknown[];
    aoa_to_sheet(data: string[][]): unknown;
    book_new(): unknown;
    book_append_sheet(wb: unknown, ws: unknown, name: string): void;
  };
  write(wb: unknown, opts: Record<string, unknown>): unknown;
}

/** Read the first sheet of a workbook into a trimmed `string[][]` grid. */
export function readWorkbookRows(data: ArrayBuffer, XLSX: XlsxLike): string[][] {
  const wb = XLSX.read(data, { type: "array" });
  const first = wb.SheetNames[0];
  if (!first) throw new ParseError("The file has no sheets.");
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[first], {
    header: 1,
    raw: false,
    defval: "",
    blankrows: false,
  }) as unknown[][];
  return rows.map((r) => r.map((c) => (c == null ? "" : String(c).trim())));
}

const isBlank = (s: string) => s == null || String(s).trim() === "";
const isNumeric = (s: string) => !isBlank(s) && !Number.isNaN(Number(s));

function stripEmptyTrailingCols(rows: string[][]): string[][] {
  const width = rows.reduce((w, r) => Math.max(w, r.length), 0);
  let last = width;
  while (last > 0 && rows.every((r) => isBlank(r[last - 1] ?? ""))) last--;
  return rows.map((r) => {
    const out = r.slice(0, last);
    while (out.length < last) out.push("");
    return out;
  });
}

/**
 * Auto-detect LONG vs WIDE.
 *
 * WIDE is recognized when the header columns (after the first) form repeated
 * group prefixes — i.e. at least one group owns ≥2 replicate columns whose
 * names share a prefix (e.g. `Drug A_1`, `Drug A_2`). Otherwise a 3-column
 * sheet is treated as LONG. Falls back to WIDE for anything else.
 */
export function detectShape(rows: string[][]): Shape {
  const clean = stripEmptyTrailingCols(rows.filter((r) => r.some((c) => !isBlank(c))));
  if (clean.length === 0) throw new ParseError("The sheet is empty.");
  const header = clean[0];
  const ncols = header.length;

  if (ncols === 3) {
    const h = header.map((s) => s.toLowerCase());
    const headerLooksLong =
      /group|cond|treat|series/.test(h[0]) &&
      /value|val|measure|y|response|result/.test(h[2]);
    if (headerLooksLong) return "long";
    // Body heuristic: in LONG the group column repeats categorical labels and
    // the value column is numeric.
    const body = clean.slice(1);
    if (body.length >= 2) {
      const col0 = body.map((r) => r[0]);
      const distinct = new Set(col0).size;
      const valuesNumeric = body.every((r) => isBlank(r[2]) || isNumeric(r[2]));
      if (distinct < col0.length && valuesNumeric) return "long";
    }
  }

  // WIDE detection via repeated header prefixes.
  const prefixes = header.slice(1).map(groupPrefix);
  const counts = new Map<string, number>();
  for (const p of prefixes) counts.set(p, (counts.get(p) ?? 0) + 1);
  if ([...counts.values()].some((c) => c >= 2)) return "wide";

  return ncols === 3 ? "long" : "wide";
}

/** Group name from a wide-format replicate column header (`Drug A_2` → `Drug A`). */
export function groupPrefix(header: string): string {
  const h = header.trim();
  // Strip a trailing _N / .N / -N / " N" replicate suffix.
  const m = h.match(/^(.*?)[\s._-]*\d+$/);
  return (m ? m[1] : h).trim() || h;
}

function uniqueInOrder(items: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const it of items) {
    if (!seen.has(it)) {
      seen.add(it);
      out.push(it);
    }
  }
  return out;
}

/** Parse a LONG-format grid into ParsedData. */
export function parseLong(rows: string[][]): ParsedData {
  const clean = stripEmptyTrailingCols(rows.filter((r) => r.some((c) => !isBlank(c))));
  if (clean.length < 2) throw new ParseError("LONG format needs a header row plus at least one data row.");
  const header = clean[0];
  if (header.length < 3) {
    throw new ParseError("LONG format needs 3 columns: Group, X, Value.");
  }
  const body = clean.slice(1);
  const warnings: string[] = [];

  body.forEach((r, i) => {
    if (r.length < 3) {
      throw new ParseError(`Row ${i + 2} is ragged — expected 3 columns (Group, X, Value).`);
    }
    if (!isBlank(r[2]) && !isNumeric(r[2])) {
      throw new ParseError(`Non-numeric value "${r[2]}" in row ${i + 2}, column "${header[2] || "Value"}".`);
    }
  });

  const groupNames = uniqueInOrder(body.map((r) => r[0]).filter((s) => !isBlank(s)));
  const xLabels = uniqueInOrder(body.map((r) => r[1]).filter((s) => !isBlank(s)));
  const gi = new Map(groupNames.map((g, i) => [g, i]));
  const xi = new Map(xLabels.map((x, i) => [x, i]));

  const cells: string[][][] = groupNames.map(() => xLabels.map(() => []));
  for (const r of body) {
    if (isBlank(r[0]) || isBlank(r[1]) || isBlank(r[2])) continue;
    cells[gi.get(r[0])!][xi.get(r[1])!].push(r[2]);
  }
  return { shape: "long", xLabels, groupNames, cells, warnings };
}

/** Parse a WIDE-format grid into ParsedData. */
export function parseWide(rows: string[][]): ParsedData {
  const clean = stripEmptyTrailingCols(rows.filter((r) => r.some((c) => !isBlank(c))));
  if (clean.length < 2) throw new ParseError("WIDE format needs a header row plus at least one data row.");
  const header = clean[0];
  if (header.length < 2) {
    throw new ParseError("WIDE format needs an X column plus at least one value column.");
  }
  const body = clean.slice(1);
  const warnings: string[] = [];

  // Map each value column (index 1..) to its group, preserving group order.
  const colGroup = header.slice(1).map(groupPrefix);
  const groupNames = uniqueInOrder(colGroup);
  const gi = new Map(groupNames.map((g, i) => [g, i]));

  const xLabels: string[] = [];
  const cells: string[][][] = groupNames.map(() => []);
  groupNames.forEach((_, g) => (cells[g] = []));

  body.forEach((r, ri) => {
    const x = r[0];
    if (isBlank(x)) return;
    const xIndex = xLabels.length;
    xLabels.push(x);
    groupNames.forEach((_, g) => cells[g].push([]));
    for (let c = 1; c < header.length; c++) {
      const val = r[c] ?? "";
      if (isBlank(val)) continue;
      if (!isNumeric(val)) {
        throw new ParseError(`Non-numeric value "${val}" in row ${ri + 2}, column "${header[c]}".`);
      }
      const g = gi.get(colGroup[c - 1])!;
      cells[g][xIndex].push(val);
    }
  });

  if (xLabels.length === 0) throw new ParseError("WIDE format: no data rows with an X value.");
  return { shape: "wide", xLabels, groupNames, cells, warnings };
}

/** Parse a grid using the given (or auto-detected) shape. */
export function parseRows(rows: string[][], shape?: Shape): ParsedData {
  const s = shape ?? detectShape(rows);
  const data = s === "long" ? parseLong(rows) : parseWide(rows);
  if (shape && shape !== detectShapeSafe(rows)) {
    // Honor the manual override but note it.
    data.warnings.push(`Parsed as ${s.toUpperCase()} (manual override).`);
  }
  if (data.groupNames.length === 0) throw new ParseError("No groups found.");
  return data;
}

function detectShapeSafe(rows: string[][]): Shape | null {
  try {
    return detectShape(rows);
  } catch {
    return null;
  }
}

/** Read + parse a workbook end-to-end. */
export function parseWorkbook(data: ArrayBuffer, XLSX: XlsxLike, shape?: Shape): ParsedData {
  return parseRows(readWorkbookRows(data, XLSX), shape);
}

// ---------------------------------------------------------------------------
// Templates
// ---------------------------------------------------------------------------

/** Example rows for a downloadable template in the requested shape. */
export function templateRows(shape: Shape): string[][] {
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
      ["Drug A", "24", "31"],
    ];
  }
  return [
    ["X", "Control_1", "Control_2", "Control_3", "Drug A_1", "Drug A_2", "Drug A_3"],
    ["0", "18", "20", "22", "20", "22", "24"],
    ["24", "32", "34", "36", "27", "29", "31"],
    ["48", "45", "47", "49", "35", "37", "39"],
    ["72", "52", "54", "56", "40", "42", "44"],
  ];
}

/** Serialize rows to CSV text. */
export function toCsv(rows: string[][]): string {
  return rows
    .map((r) =>
      r
        .map((c) => (/[",\n]/.test(c) ? '"' + c.replace(/"/g, '""') + '"' : c))
        .join(",")
    )
    .join("\n");
}
