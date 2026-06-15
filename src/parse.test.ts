import {
  detectShape,
  groupPrefix,
  parseLong,
  parseWide,
  parseRows,
  templateRows,
  toCsv,
  ParseError,
} from "./parse";

describe("groupPrefix", () => {
  test.each([
    ["Drug A_1", "Drug A"],
    ["Control_12", "Control"],
    ["GroupB.3", "GroupB"],
    ["x-2", "x"],
    ["Treated 1", "Treated"],
    ["NoSuffix", "NoSuffix"],
  ])("%s -> %s", (input, expected) => {
    expect(groupPrefix(input)).toBe(expected);
  });
});

describe("detectShape", () => {
  test("3-column Group/X/Value header is LONG", () => {
    const rows = [
      ["Group", "X", "Value"],
      ["A", "0", "1"],
      ["A", "1", "2"],
    ];
    expect(detectShape(rows)).toBe("long");
  });

  test("repeated group prefixes mean WIDE", () => {
    const rows = [
      ["X", "A_1", "A_2", "B_1", "B_2"],
      ["0", "1", "2", "3", "4"],
    ];
    expect(detectShape(rows)).toBe("wide");
  });

  test("3-column with repeating categorical col0 is LONG even without keyword header", () => {
    const rows = [
      ["cond", "time", "y"],
      ["ctrl", "0", "5"],
      ["ctrl", "1", "6"],
      ["drug", "0", "7"],
    ];
    expect(detectShape(rows)).toBe("long");
  });

  test("empty sheet throws", () => {
    expect(() => detectShape([[""], [""]])).toThrow(ParseError);
  });
});

describe("parseLong", () => {
  test("groups replicates by (group, x)", () => {
    const rows = [
      ["Group", "X", "Value"],
      ["Control", "0", "18"],
      ["Control", "0", "20"],
      ["Control", "24", "32"],
      ["Drug", "0", "21"],
      ["Drug", "24", "30"],
    ];
    const d = parseLong(rows);
    expect(d.groupNames).toEqual(["Control", "Drug"]);
    expect(d.xLabels).toEqual(["0", "24"]);
    expect(d.cells[0][0]).toEqual(["18", "20"]); // Control @ 0
    expect(d.cells[0][1]).toEqual(["32"]); // Control @ 24
    expect(d.cells[1][0]).toEqual(["21"]); // Drug @ 0
  });

  test("non-numeric value throws with location", () => {
    const rows = [
      ["Group", "X", "Value"],
      ["A", "0", "oops"],
    ];
    expect(() => parseLong(rows)).toThrow(/Non-numeric value "oops".*row 2/);
  });

  test("blank cells are ignored, not errors", () => {
    const rows = [
      ["Group", "X", "Value"],
      ["A", "0", "1"],
      ["A", "0", ""],
      ["A", "0", "3"],
    ];
    const d = parseLong(rows);
    expect(d.cells[0][0]).toEqual(["1", "3"]);
  });
});

describe("parseWide", () => {
  test("maps replicate columns to groups and rows to X", () => {
    const rows = [
      ["X", "Control_1", "Control_2", "Drug A_1", "Drug A_2"],
      ["0", "18", "20", "20", "22"],
      ["24", "32", "34", "27", "29"],
    ];
    const d = parseWide(rows);
    expect(d.groupNames).toEqual(["Control", "Drug A"]);
    expect(d.xLabels).toEqual(["0", "24"]);
    expect(d.cells[0][0]).toEqual(["18", "20"]); // Control @ 0
    expect(d.cells[1][1]).toEqual(["27", "29"]); // Drug A @ 24
  });

  test("ragged / blank replicate cells are tolerated", () => {
    const rows = [
      ["X", "A_1", "A_2", "A_3"],
      ["0", "1", "", "3"],
    ];
    const d = parseWide(rows);
    expect(d.cells[0][0]).toEqual(["1", "3"]);
  });

  test("non-numeric value throws", () => {
    const rows = [
      ["X", "A_1", "A_2"],
      ["0", "1", "bad"],
    ];
    expect(() => parseWide(rows)).toThrow(/Non-numeric value "bad"/);
  });
});

describe("parseRows auto-detect + override", () => {
  test("auto-detects long", () => {
    const d = parseRows([
      ["Group", "X", "Value"],
      ["A", "0", "1"],
      ["A", "1", "2"],
    ]);
    expect(d.shape).toBe("long");
  });

  test("manual override is honored and noted", () => {
    // A 3-col sheet auto-detects long; force wide.
    const rows = [
      ["X", "A_1", "B_1"],
      ["0", "1", "2"],
    ];
    const d = parseRows(rows, "wide");
    expect(d.shape).toBe("wide");
  });
});

describe("templates", () => {
  test("long template round-trips through detect", () => {
    expect(detectShape(templateRows("long"))).toBe("long");
  });
  test("wide template round-trips through detect", () => {
    expect(detectShape(templateRows("wide"))).toBe("wide");
  });
  test("toCsv quotes fields with commas", () => {
    expect(toCsv([["a", "b,c"], ["1", "2"]])).toBe('a,"b,c"\n1,2');
  });
});
