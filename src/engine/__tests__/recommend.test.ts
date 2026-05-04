import { describe, expect, it } from "vitest";
import type { Answers, TestId } from "../../types";
import { recommend } from "../recommend";

// Gold-standard cases. Each case is a profile where Fred / the midwives would
// pick a specific test. These lock the scoring weights: if someone tunes a
// weight and one of these flips, we want to know.
interface Case {
  name: string;
  answers: Answers;
  expect:
    | { kind: "recommend"; primary: TestId; alsoConsiderOneOf?: TestId[] }
    | { kind: "midwife" }
    | { kind: "wait" };
}

const CASES: Case[] = [
  {
    name: "singleton, natural, reassurance-only, fewer false alarms, low budget → cheapest aneuploidy option",
    answers: {
      gestationalAge: "10-plus",
      pregnancyType: "singleton",
      conception: "natural",
      motivation: "reassurance-main",
      historyFlags: ["none"],
      uncertainty: "fewer-false-alarms",
      speed: "within-2-weeks",
    },
    expect: {
      kind: "recommend",
      primary: "aneuploidy-nipt",
      alsoConsiderOneOf: ["prenatalsafe-3-uk", "panorama-basic"],
    },
  },
  {
    name: "singleton, wants sex + SCAs → Panorama Basic",
    answers: {
      gestationalAge: "10-plus",
      pregnancyType: "singleton",
      conception: "natural",
      motivation: "main-plus-sex",
      historyFlags: ["none"],
      uncertainty: "fewer-false-alarms",
      speed: "within-2-weeks",
    },
    expect: { kind: "recommend", primary: "panorama-basic" },
  },
  {
    name: "twins → midwife (no validated test in our recommendable set)",
    answers: {
      gestationalAge: "10-plus",
      pregnancyType: "twin",
      conception: "ivf-own-eggs",
      motivation: "max-info",
      historyFlags: ["none"],
      uncertainty: "rather-know",
      speed: "happy-to-wait",
    },
    expect: { kind: "midwife" },
  },
  {
    name: "donor egg → midwife (no validated test in our recommendable set)",
    answers: {
      gestationalAge: "10-plus",
      pregnancyType: "singleton",
      conception: "donor-egg",
      motivation: "reassurance-main",
      historyFlags: ["none"],
      uncertainty: "fewer-false-alarms",
      speed: "within-2-weeks",
    },
    expect: { kind: "midwife" },
  },
  {
    name: "singleton, paternal 45+, wants max info → KNOVA or Complete Plus",
    answers: {
      gestationalAge: "10-plus",
      pregnancyType: "singleton",
      conception: "natural",
      motivation: "max-info",
      historyFlags: ["paternal-45-plus"],
      uncertainty: "rather-know",
      speed: "within-2-weeks",
    },
    expect: {
      kind: "recommend",
      primary: "knova",
      alsoConsiderOneOf: ["niptify", "panorama-microdeletions", "unity-complete"],
    },
  },
  {
    name: "singleton, both Ashkenazi, specific-history motivation → Unity Complete",
    answers: {
      gestationalAge: "10-plus",
      pregnancyType: "singleton",
      conception: "natural",
      motivation: "specific-history",
      historyFlags: ["both-partners-ashkenazi"],
      uncertainty: "rather-know",
      speed: "happy-to-wait",
    },
    expect: { kind: "recommend", primary: "unity-complete" },
  },
  {
    name: "singleton, need results ASAP, reassurance only → PrenatalSafe 3 UK",
    answers: {
      gestationalAge: "10-plus",
      pregnancyType: "singleton",
      conception: "natural",
      motivation: "reassurance-main",
      historyFlags: ["none"],
      uncertainty: "fewer-false-alarms",
      speed: "asap",
    },
    expect: { kind: "recommend", primary: "prenatalsafe-3-uk" },
  },
  {
    name: "high-risk NHS combined test result → midwife-first",
    answers: {
      gestationalAge: "10-plus",
      pregnancyType: "singleton",
      conception: "natural",
      motivation: "high-risk-nhs",
      historyFlags: [],
      uncertainty: "rather-know",
      speed: "asap",
    },
    expect: { kind: "midwife" },
  },
  {
    name: "previous affected pregnancy → midwife-first regardless of other answers",
    answers: {
      gestationalAge: "10-plus",
      pregnancyType: "singleton",
      conception: "natural",
      motivation: "reassurance-main",
      historyFlags: ["previous-affected-pregnancy"],
      uncertainty: "fewer-false-alarms",
      speed: "happy-to-wait",
    },
    expect: { kind: "midwife" },
  },
  {
    name: "under 9 weeks → come-back-later",
    answers: {
      gestationalAge: "under-9",
      pregnancyType: "singleton",
      conception: "natural",
      motivation: "reassurance-main",
      historyFlags: [],
      uncertainty: "fewer-false-alarms",
      speed: "within-2-weeks",
    },
    expect: { kind: "wait" },
  },
  {
    name: "max-info AND fewer-false-alarms is a conflict: fewer-false-alarms wins → narrower test",
    answers: {
      gestationalAge: "10-plus",
      pregnancyType: "singleton",
      conception: "natural",
      motivation: "max-info",
      historyFlags: ["none"],
      uncertainty: "fewer-false-alarms",
      speed: "within-2-weeks",
    },
    // When these two preferences conflict, the clinical principle is "fewer
    // false alarms wins". A broad panel would flag things that aren't real.
    // So the engine should pick a narrower test (Panorama Basic), with the
    // conflict surfaced in the UI copy.
    expect: { kind: "recommend", primary: "panorama-basic" },
  },
];

describe("recommend()", () => {
  for (const c of CASES) {
    it(c.name, () => {
      const r = recommend(c.answers);
      switch (c.expect.kind) {
        case "wait":
          expect(r.shortCircuit?.kind).toBe("wait");
          break;
        case "midwife":
          expect(r.shortCircuit?.kind).toBe("midwife");
          break;
        case "recommend": {
          expect(r.shortCircuit).toBeUndefined();
          expect(r.primary).toBeDefined();
          expect(r.primary?.test.id).toBe(c.expect.primary);
          if (c.expect.alsoConsiderOneOf && r.alsoConsider) {
            expect(c.expect.alsoConsiderOneOf).toContain(r.alsoConsider.test.id);
          }
          break;
        }
      }
    });
  }
});

describe("recommend() — new fallback + always-two-options behaviour", () => {
  it("twin pregnancy at 9-10 weeks → midwife (Complete Plus is no longer recommended)", () => {
    const r = recommend({
      gestationalAge: "9-to-10",
      pregnancyType: "twin",
      conception: "natural",
      motivation: "reassurance-main",
      historyFlags: ["none"],
      uncertainty: "fewer-false-alarms",
      speed: "within-2-weeks",
    });
    expect(r.shortCircuit?.kind).toBe("midwife");
    expect(r.shortCircuit?.kind === "midwife" && r.shortCircuit.reason.toLowerCase()).toMatch(/twin|midwife/);
  });

  it("always surfaces a second option when the patient has a real recommendation", () => {
    const r = recommend({
      gestationalAge: "10-plus",
      pregnancyType: "singleton",
      conception: "natural",
      motivation: "main-plus-sex",
      historyFlags: ["none"],
      uncertainty: "fewer-false-alarms",
      speed: "within-2-weeks",
    });
    expect(r.primary).toBeDefined();
    expect(r.alsoConsider).toBeDefined();
    expect(r.alsoConsider!.test.id).not.toBe(r.primary!.test.id);
    expect(r.alsoConsider!.tradeOff.length).toBeGreaterThan(0);
  });

  it("comprehensive request → KNOVA primary, Complete Plus never appears (retired from recommendations)", () => {
    const r = recommend({
      gestationalAge: "10-plus",
      pregnancyType: "singleton",
      conception: "natural",
      motivation: "max-info",
      historyFlags: ["paternal-45-plus"],
      uncertainty: "rather-know",
      speed: "happy-to-wait",
    });
    expect(r.primary?.test.id).toBe("knova");
    expect(r.alsoConsider?.test.id).not.toBe("prenatalsafe-complete-plus");
    expect(r.allScores.find((s) => s.testId === "prenatalsafe-complete-plus")).toBeUndefined();
  });

  it("vanishing twin pregnancy at 10+ weeks → PrenatalSafe 3 UK (the only validated option)", () => {
    const r = recommend({
      gestationalAge: "10-plus",
      pregnancyType: "vanishing-twin",
      conception: "natural",
      motivation: "max-info",
      historyFlags: ["none"],
      uncertainty: "rather-know",
      speed: "happy-to-wait",
    });
    expect(r.shortCircuit).toBeUndefined();
    expect(r.primary?.test.id).toBe("prenatalsafe-3-uk");
    // Complete Plus is no longer eligible for vanishing twin, so it must NOT
    // appear as the alternative either.
    expect(r.alsoConsider?.test.id).not.toBe("prenatalsafe-complete-plus");
  });

  it("vanishing twin at 9-10 weeks → fallback recommends PrenatalSafe 3 UK with timing copy", () => {
    const r = recommend({
      gestationalAge: "9-to-10",
      pregnancyType: "vanishing-twin",
      conception: "natural",
      motivation: "reassurance-main",
      historyFlags: ["none"],
      uncertainty: "fewer-false-alarms",
      speed: "within-2-weeks",
    });
    expect(r.shortCircuit).toBeUndefined();
    expect(r.primary?.test.id).toBe("prenatalsafe-3-uk");
    const why = r.primary!.whyBullets.join(" ").toLowerCase();
    expect(why).toMatch(/vanishing twin|5 weeks|10 weeks/);
  });

  it("twin pregnancy → midwife (Complete Plus retired, no validated test in our recommendable set)", () => {
    const r = recommend({
      gestationalAge: "10-plus",
      pregnancyType: "twin",
      conception: "ivf-own-eggs",
      motivation: "max-info",
      historyFlags: ["none"],
      uncertainty: "rather-know",
      speed: "happy-to-wait",
    });
    expect(r.shortCircuit?.kind).toBe("midwife");
  });

  it("every non-short-circuit recommendation has at least 2 why-bullets", () => {
    const answersPermutations: Answers[] = [
      { gestationalAge: "10-plus", pregnancyType: "singleton", conception: "natural", motivation: "reassurance-main", uncertainty: "fewer-false-alarms", speed: "within-2-weeks" },
      { gestationalAge: "10-plus", pregnancyType: "singleton", conception: "ivf-own-eggs", motivation: "max-info", uncertainty: "rather-know", speed: "happy-to-wait" },
      { gestationalAge: "10-plus", pregnancyType: "singleton", conception: "natural", motivation: "specific-history", historyFlags: ["both-partners-ashkenazi"], uncertainty: "rather-know", speed: "happy-to-wait" },
    ];
    for (const a of answersPermutations) {
      const r = recommend(a);
      if (r.shortCircuit) continue;
      expect(r.primary?.whyBullets.length).toBeGreaterThanOrEqual(2);
    }
  });
});

describe("recommend() — invariants", () => {
  it("returns a deterministic recommendation for identical input", () => {
    const answers: Answers = {
      gestationalAge: "10-plus",
      pregnancyType: "singleton",
      conception: "natural",
      motivation: "main-plus-sex",
      historyFlags: ["none"],
      uncertainty: "rather-know",
      speed: "within-2-weeks",
    };
    const a = recommend(answers);
    const b = recommend(answers);
    expect(a.primary?.test.id).toBe(b.primary?.test.id);
    expect(a.primary?.score.total).toBe(b.primary?.score.total);
  });

  it("twin pregnancy → midwife short-circuit (no validated test in our recommendable set)", () => {
    const r = recommend({
      gestationalAge: "10-plus",
      pregnancyType: "twin",
      conception: "natural",
      motivation: "max-info",
      uncertainty: "rather-know",
      speed: "happy-to-wait",
    });
    expect(r.shortCircuit?.kind).toBe("midwife");
  });

  it("donor-egg pregnancy → midwife short-circuit (no validated test in our recommendable set)", () => {
    const r = recommend({
      gestationalAge: "10-plus",
      pregnancyType: "singleton",
      conception: "donor-egg",
      motivation: "reassurance-main",
      uncertainty: "fewer-false-alarms",
      speed: "within-2-weeks",
    });
    expect(r.shortCircuit?.kind).toBe("midwife");
  });

  it("Complete Plus is never returned in any recommendation", () => {
    // Spot-check a few representative singleton profiles. None should ever
    // surface Complete Plus as primary, alsoConsider, or in allScores.
    const profiles: Answers[] = [
      { gestationalAge: "10-plus", pregnancyType: "singleton", conception: "natural", motivation: "max-info", historyFlags: ["paternal-45-plus"], uncertainty: "rather-know", speed: "happy-to-wait" },
      { gestationalAge: "10-plus", pregnancyType: "singleton", conception: "ivf-own-eggs", motivation: "specific-history", historyFlags: ["both-partners-ashkenazi"], uncertainty: "rather-know", speed: "happy-to-wait" },
      { gestationalAge: "10-plus", pregnancyType: "singleton", conception: "natural", motivation: "main-plus-sex", historyFlags: ["none"], uncertainty: "fewer-false-alarms", speed: "within-2-weeks" },
    ];
    for (const a of profiles) {
      const r = recommend(a);
      expect(r.primary?.test.id).not.toBe("prenatalsafe-complete-plus");
      expect(r.alsoConsider?.test.id).not.toBe("prenatalsafe-complete-plus");
      expect(r.allScores.find((s) => s.testId === "prenatalsafe-complete-plus")).toBeUndefined();
    }
  });

  it("surfaces a why bullet for every recommendation", () => {
    const r = recommend({
      gestationalAge: "10-plus",
      pregnancyType: "singleton",
      conception: "natural",
      motivation: "reassurance-main",
      uncertainty: "fewer-false-alarms",
      speed: "within-2-weeks",
    });
    expect(r.primary?.whyBullets.length).toBeGreaterThan(0);
  });
});
