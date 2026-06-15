import {
  assignBracketLevels,
  mmToPx,
  dpiScale,
  fileStem,
  el,
  serializeEl,
  serializeSvg,
  buildScene,
  type PlotSpec,
  type RenderSeries,
} from "./plot";

describe("assignBracketLevels", () => {
  test("non-overlapping spans share level 0", () => {
    const levels = assignBracketLevels([
      [0, 1],
      [2, 3],
    ]);
    expect(levels).toEqual([0, 0]);
  });

  test("overlapping spans get distinct levels", () => {
    // [0,2] overlaps [1,3]
    const levels = assignBracketLevels([
      [0, 2],
      [1, 3],
    ]);
    expect(levels[0]).not.toBe(levels[1]);
  });

  test("nested spans stack: wider goes higher", () => {
    const levels = assignBracketLevels([
      [0, 3], // wide
      [0, 1], // narrow
      [2, 3], // narrow, disjoint from [0,1]
    ]);
    // the two narrow disjoint brackets can share level 0; wide must be above
    expect(levels[1]).toBe(0);
    expect(levels[2]).toBe(0);
    expect(levels[0]).toBeGreaterThan(0);
  });

  test("adjacent-but-touching spans are treated as overlapping", () => {
    const levels = assignBracketLevels([
      [0, 1],
      [1, 2],
    ]);
    expect(levels[0]).not.toBe(levels[1]);
  });
});

describe("unit conversion", () => {
  test("mmToPx at 96dpi", () => {
    expect(Math.round(mmToPx(25.4))).toBe(96);
    expect(Math.round(mmToPx(120))).toBe(Math.round((120 / 25.4) * 96));
  });
  test("dpiScale", () => {
    expect(dpiScale(96)).toBe(1);
    expect(dpiScale(300)).toBeCloseTo(3.125, 3);
    expect(dpiScale(600)).toBeCloseTo(6.25, 3);
  });
  test("fileStem sanitizes titles", () => {
    expect(fileStem("Cell viability over time")).toBe("Cell_viability_over_time");
    expect(fileStem("a/b:c*d")).toBe("abcd");
    expect(fileStem("")).toBe("plot");
    expect(fileStem("", "figure")).toBe("figure");
  });
});

describe("serialization", () => {
  test("void element with attrs", () => {
    expect(serializeEl(el("line", { x1: 0, y1: 1, x2: 2, y2: 3 }))).toBe(
      '<line x1="0" y1="1" x2="2" y2="3"/>'
    );
  });
  test("text element escapes content and drops key", () => {
    expect(serializeEl(el("text", { x: 1, key: "k" }, "a & b < c"))).toBe(
      '<text x="1">a &amp; b &lt; c</text>'
    );
  });
  test("nested group", () => {
    const g = el("g", {}, el("circle", { cx: 1, cy: 2, r: 3 }));
    expect(serializeEl(g)).toBe('<g><circle cx="1" cy="2" r="3"/></g>');
  });
});

function lineSeries(name: string, color: string, means: number[]): RenderSeries {
  return {
    name,
    color,
    marker: "circle",
    line: "solid",
    points: means.map((m, i) => ({ xLabel: String(i), xNum: i, mean: m, err: 2, n: 3, values: [m - 1, m, m + 1] })),
    agg: { mean: means[means.length - 1], err: 2, sd: 1, n: 3, values: [means[0]] },
  };
}

const baseSpec = (over: Partial<PlotSpec> = {}): PlotSpec => ({
  plotType: "line",
  errorType: "sem",
  xAxisType: "numeric",
  series: [lineSeries("A", "#0072B2", [10, 20, 30]), lineSeries("B", "#E69F00", [12, 18, 24])],
  xLabels: ["0", "1", "2"],
  xTitle: "X",
  yTitle: "Y",
  plotTitle: "",
  yAuto: true,
  yMin: 0,
  yMax: 100,
  yLog: false,
  xLog: false,
  gridlines: false,
  legendPos: "top-right",
  barWidth: 64,
  barOutline: true,
  violinInner: "box",
  showPoints: false,
  showSig: false,
  compareAtEachX: false,
  sigDisplay: "asterisks",
  brackets: [],
  ...over,
});

describe("buildScene", () => {
  test("produces a serializable svg root with viewBox", () => {
    const scene = buildScene(baseSpec());
    expect(scene.root.tag).toBe("svg");
    const svg = serializeSvg(scene);
    expect(svg).toContain("<svg");
    expect(svg).toContain("viewBox");
    expect(svg).toContain("xmlns=");
  });

  test("series color reaches lines, markers and error bars", () => {
    const svg = serializeSvg(buildScene(baseSpec()));
    // the A-series color is used for path stroke, marker fill, and error bars
    const count = (svg.match(/#0072B2/gi) || []).length;
    expect(count).toBeGreaterThan(3);
  });

  test("gridlines toggle adds gridline elements", () => {
    const off = serializeSvg(buildScene(baseSpec({ gridlines: false })));
    const on = serializeSvg(buildScene(baseSpec({ gridlines: true })));
    expect((on.match(/#eceff3/g) || []).length).toBeGreaterThan(
      (off.match(/#eceff3/g) || []).length
    );
  });

  test("bar with significance brackets emits bracket geometry", () => {
    const scene = buildScene(
      baseSpec({
        plotType: "bar",
        xAxisType: "categorical",
        showSig: true,
        brackets: [
          { aIndex: 0, bIndex: 1, label: "**", isNs: false },
        ],
      })
    );
    const svg = serializeSvg(scene);
    expect(svg).toContain(">**<");
  });

  test("outside-right legend widens the canvas", () => {
    const inside = buildScene(baseSpec({ legendPos: "top-right" }));
    const outside = buildScene(baseSpec({ legendPos: "outside-right" }));
    expect(outside.width).toBeGreaterThan(inside.width);
  });

  test("log Y uses decade ticks", () => {
    const scene = buildScene(
      baseSpec({ yLog: true, yAuto: false, yMin: 1, yMax: 1000 })
    );
    const svg = serializeSvg(scene);
    expect(svg).toContain(">1000<");
  });
});

describe("themes", () => {
  test("default (prism) theme draws only left+bottom axis lines with outward ticks", () => {
    const svg = serializeSvg(buildScene(baseSpec()));
    // 2 axis lines + outward y/x ticks; no boxed top/right lines
    expect(svg).toContain('stroke="#1f2733"');
    expect(svg).toContain("Helvetica");
  });

  test("nature theme draws a boxed (4-line) axis frame in black", () => {
    const prism = serializeSvg(buildScene(baseSpec()));
    const nature = serializeSvg(buildScene(baseSpec({ theme: "nature" })));
    const countLines = (svg: string) => (svg.match(/<line /g) || []).length;
    expect(countLines(nature)).toBeGreaterThan(countLines(prism));
    expect(nature).toContain('stroke="#000000"');
    expect(nature).toContain("Arial");
  });

  test("fontFamily overrides the theme's default font", () => {
    const svg = serializeSvg(buildScene(baseSpec({ fontFamily: "'Times New Roman', Times, serif" })));
    expect(svg).toContain("Times New Roman");
    expect(svg).not.toContain("Helvetica");
  });

  test("unknown theme id falls back to prism", () => {
    const fallback = serializeSvg(buildScene(baseSpec({ theme: "bogus" })));
    const prism = serializeSvg(buildScene(baseSpec()));
    expect(fallback).toEqual(prism);
  });
});
