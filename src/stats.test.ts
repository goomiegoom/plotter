import {
  logGamma,
  incompleteBeta,
  normalCdf,
  studentTTwoTailedP,
  studentTInv,
  fUpperTailP,
  cleanValues,
  mean,
  sampleSD,
  describe as describeStats,
  errorValue,
  unpairedT,
  welchT,
  pairedT,
  mannWhitneyU,
  oneWayANOVA,
  pToSymbol,
  adjustPValues,
  runComparisons,
  LocalPostHocProvider,
  type GroupValues,
} from "./stats";

const near = (a: number, b: number, tol = 1e-3) => Math.abs(a - b) <= tol;

describe("special functions", () => {
  test("logGamma matches factorials", () => {
    expect(near(Math.exp(logGamma(5)), 24)).toBe(true); // 4!
    expect(near(Math.exp(logGamma(6)), 120)).toBe(true); // 5!
  });

  test("incompleteBeta endpoints and symmetry", () => {
    expect(incompleteBeta(0, 2, 3)).toBe(0);
    expect(incompleteBeta(1, 2, 3)).toBe(1);
    // I_0.5(a,a) == 0.5 by symmetry
    expect(near(incompleteBeta(0.5, 4, 4), 0.5)).toBe(true);
  });

  test("normalCdf reference values", () => {
    expect(near(normalCdf(0), 0.5)).toBe(true);
    expect(near(normalCdf(1.96), 0.975, 1e-3)).toBe(true);
    expect(near(normalCdf(-1.96), 0.025, 1e-3)).toBe(true);
  });

  test("studentTInv gives standard t critical values", () => {
    // t(0.975, df): classic table values
    expect(near(studentTInv(0.975, 1), 12.706, 2e-2)).toBe(true);
    expect(near(studentTInv(0.975, 10), 2.228, 2e-3)).toBe(true);
    expect(near(studentTInv(0.975, 30), 2.042, 2e-3)).toBe(true);
    // large df approaches z = 1.96
    expect(near(studentTInv(0.975, 100000), 1.96, 2e-3)).toBe(true);
  });

  test("studentTTwoTailedP reference", () => {
    // t=2.228, df=10 -> p ~ 0.05
    expect(near(studentTTwoTailedP(2.228, 10), 0.05, 2e-3)).toBe(true);
    // t=0 -> p=1
    expect(near(studentTTwoTailedP(0, 5), 1)).toBe(true);
  });

  test("fUpperTailP reference", () => {
    // F=1 with equal df -> p=0.5
    expect(near(fUpperTailP(1, 10, 10), 0.5, 1e-2)).toBe(true);
    // Large F -> small p
    expect(fUpperTailP(10, 2, 20)).toBeLessThan(0.01);
  });
});

describe("cleaning + descriptive", () => {
  test("cleanValues drops blanks and non-numerics", () => {
    expect(cleanValues(["1", "", "2", "abc", "3", "  "])).toEqual([1, 2, 3]);
    expect(cleanValues("4, 5 6")).toEqual([4, 5, 6]);
    expect(cleanValues([10, NaN, 20])).toEqual([10, 20]);
  });

  test("mean and sample SD (n-1)", () => {
    const v = [2, 4, 4, 4, 5, 5, 7, 9];
    expect(mean(v)).toBe(5);
    // population SD is 2; sample SD (n-1) is ~2.138
    expect(near(sampleSD(v), 2.138, 1e-3)).toBe(true);
  });

  test("describe computes n, mean, sd, sem, ci per point ignoring blanks", () => {
    const s = describeStats(["10", "", "12", "14"]);
    expect(s.n).toBe(3);
    expect(near(s.mean, 12)).toBe(true);
    expect(near(s.sd, 2)).toBe(true);
    expect(near(s.sem, 2 / Math.sqrt(3))).toBe(true);
    // CI half-width = t(0.975, 2) * sem; t(0.975,2)=4.303
    expect(near(s.ci95, 4.303 * (2 / Math.sqrt(3)), 1e-2)).toBe(true);
  });

  test("describe with n<2 yields zero spread", () => {
    const s = describeStats(["7"]);
    expect(s.n).toBe(1);
    expect(s.sd).toBe(0);
    expect(s.sem).toBe(0);
    expect(s.ci95).toBe(0);
  });

  test("errorValue selects the requested type", () => {
    const s = describeStats(["10", "12", "14"]);
    expect(errorValue(s, "sd")).toBe(s.sd);
    expect(errorValue(s, "sem")).toBe(s.sem);
    expect(errorValue(s, "ci")).toBe(s.ci95);
  });
});

describe("t-tests", () => {
  const a = [5.1, 4.9, 5.0, 5.2, 4.8];
  const b = [6.2, 5.9, 6.1, 6.3, 6.0];

  test("unpaired pooled t-test", () => {
    const r = unpairedT(a, b);
    expect(r.df).toBe(8);
    // groups well separated -> very small p
    expect(r.p).toBeLessThan(1e-4);
    expect(Math.abs(r.t)).toBeGreaterThan(10);
  });

  test("welch t-test df is fractional and p small", () => {
    const r = welchT(a, b);
    expect(r.df).toBeGreaterThan(0);
    expect(r.df).toBeLessThanOrEqual(8);
    expect(r.p).toBeLessThan(1e-4);
  });

  test("paired t-test on matched samples", () => {
    const before = [120, 122, 143, 130, 135];
    const after = [115, 117, 140, 125, 128];
    const r = pairedT(before, after);
    expect(r.df).toBe(4);
    // consistent reduction -> significant
    expect(r.p).toBeLessThan(0.05);
    expect(r.t).toBeGreaterThan(0);
  });

  test("paired requires equal length", () => {
    expect(() => pairedT([1, 2], [1])).toThrow();
  });

  test("identical groups give p≈1", () => {
    const r = unpairedT([1, 2, 3], [1, 2, 3]);
    expect(near(r.p, 1)).toBe(true);
  });
});

describe("Mann–Whitney U", () => {
  test("exact path for small samples, no ties", () => {
    const r = mannWhitneyU([1, 2, 3, 4], [5, 6, 7, 8]);
    expect(r.method).toBe("exact");
    // complete separation, n1=n2=4 -> two-sided p = 2/70
    expect(near(r.p, 2 / 70, 1e-6)).toBe(true);
    expect(r.U).toBe(0);
  });

  test("normal approximation used when ties present", () => {
    const r = mannWhitneyU([1, 2, 2, 3], [2, 4, 5, 6]);
    expect(r.method).toBe("normal");
    expect(r.p).toBeGreaterThan(0);
    expect(r.p).toBeLessThanOrEqual(1);
  });

  test("overlapping groups are not significant", () => {
    const r = mannWhitneyU([1, 3, 5, 7], [2, 4, 6, 8]);
    expect(r.p).toBeGreaterThan(0.5);
  });
});

describe("one-way ANOVA", () => {
  test("omnibus F and p for separated groups", () => {
    const r = oneWayANOVA([
      [1, 2, 3],
      [4, 5, 6],
      [7, 8, 9],
    ]);
    expect(r.df1).toBe(2);
    expect(r.df2).toBe(6);
    expect(r.F).toBeGreaterThan(10);
    expect(r.p).toBeLessThan(0.01);
  });

  test("identical group means give F≈0 and p≈1", () => {
    const r = oneWayANOVA([
      [1, 2, 3],
      [1, 2, 3],
      [1, 2, 3],
    ]);
    expect(near(r.F, 0)).toBe(true);
    expect(near(r.p, 1, 1e-6)).toBe(true);
  });
});

describe("p → symbol", () => {
  test.each([
    [0.2, "ns"],
    [0.04, "*"],
    [0.005, "**"],
    [0.0005, "***"],
    [0.00005, "****"],
  ])("p=%p -> %s", (p, sym) => {
    expect(pToSymbol(p)).toBe(sym);
  });
});

describe("multiple-comparison correction", () => {
  const raw = [0.01, 0.02, 0.04];

  test("none passes through (clamped)", () => {
    expect(adjustPValues(raw, "none")).toEqual([0.01, 0.02, 0.04]);
  });

  test("bonferroni multiplies by m and clamps", () => {
    expect(adjustPValues([0.01, 0.02, 0.5], "bonferroni")).toEqual([
      0.03, 0.06, 1,
    ]);
  });

  test("holm-šídák is step-down and monotone", () => {
    const adj = adjustPValues(raw, "holm");
    // each adjusted >= raw, order preserved, non-decreasing when sorted
    expect(adj[0]).toBeGreaterThanOrEqual(raw[0]);
    expect(adj[2]).toBeGreaterThanOrEqual(adj[1]);
    expect(adj[1]).toBeGreaterThanOrEqual(adj[0]);
    // smallest: 1-(1-0.01)^3
    expect(near(adj[0], 1 - Math.pow(0.99, 3), 1e-6)).toBe(true);
  });

  test("empty input", () => {
    expect(adjustPValues([], "holm")).toEqual([]);
  });
});

describe("runComparisons (post-hoc seam)", () => {
  const groups: GroupValues[] = [
    { index: 0, name: "Control", values: [10, 11, 9, 10, 10] },
    { index: 1, name: "Drug A", values: [14, 15, 13, 14, 14] },
    { index: 2, name: "Drug B", values: [20, 21, 19, 20, 20] },
  ];

  test("all-pairs produces C(k,2) comparisons", () => {
    const cs = runComparisons(groups, {
      family: "parametric",
      parametric: "welch",
      mode: "allpairs",
      correction: "holm",
    });
    expect(cs.length).toBe(3);
    for (const c of cs) {
      expect(c.pAdjusted).toBeGreaterThanOrEqual(c.pRaw);
      expect(typeof c.symbol).toBe("string");
    }
    // all groups separated -> all significant
    expect(cs.every((c) => c.symbol !== "ns")).toBe(true);
  });

  test("vs-control restricts to comparisons against the control index", () => {
    const cs = runComparisons(groups, {
      family: "parametric",
      mode: "control",
      controlIndex: 0,
      correction: "bonferroni",
    });
    expect(cs.length).toBe(2);
    expect(cs.every((c) => c.groupA === 0)).toBe(true);
  });

  test("manual uses only the supplied pairs", () => {
    const cs = runComparisons(groups, {
      family: "nonparam",
      mode: "manual",
      pairs: [[0, 2]],
      correction: "none",
    });
    expect(cs.length).toBe(1);
    expect(cs[0].groupA).toBe(0);
    expect(cs[0].groupB).toBe(2);
    expect(cs[0].test).toBe("mann-whitney");
  });

  test("provider is swappable without touching the call site", () => {
    const provider = new LocalPostHocProvider();
    const cs = provider.runComparisons(groups, {
      family: "parametric",
      mode: "allpairs",
      correction: "none",
    });
    expect(cs.length).toBe(3);
  });
});
