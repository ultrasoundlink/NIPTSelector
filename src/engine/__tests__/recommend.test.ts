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
    name: "twins, IVF own eggs → only Complete Plus eligible",
    answers: {
      gestationalAge: "10-plus",
      pregnancyType: "twin",
      conception: "ivf-own-eggs",
      motivation: "max-info",
      historyFlags: ["none"],
      uncertainty: "rather-know",
      speed: "happy-to-wait",
    },
    expect: { kind: "recommend", primary: "prenatalsafe-complete-plus" },
  },
  {
    name: "donor egg → only Complete Plus eligible",
    answers: {
      gestationalAge: "10-plus",
      pregnancyType: "singleton",
      conception: "donor-egg",
      motivation: "reassurance-main",
      historyFlags: ["none"],
      uncertainty: "fewer-false-alarms",
      speed: "within-2-weeks",
    },
    expect: { kind: "recommend", primary: "prenatalsafe-complete-plus" },
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
      alsoConsiderOneOf: ["prenatalsafe-complete-plus", "niptify"],
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
  it("twin pregnancy at 9-10 weeks still gets a real Complete Plus recommendation with an explanation", () => {
    const r = recommend({
      gestationalAge: "9-to-10",
      pregnancyType: "twin",
      conception: "natural",
      motivation: "reassurance-main",
      historyFlags: ["none"],
      uncertainty: "fewer-false-alarms",
      speed: "within-2-weeks",
    });
    expect(r.shortCircuit).toBeUndefined();
    expect(r.primary?.test.id).toBe("prenatalsafe-complete-plus");
    expect(r.primary!.whyBullets.length).toBeGreaterThanOrEqual(1);
    const why = r.primary!.whyBullets.join(" ").toLowerCase();
    expect(why).toMatch(/twin|weeks|broadest/);
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

  it("when KNOVA is eligible, Complete Plus never wins as primary (clinical bias to steer toward KNOVA)", () => {
    // A patient who wants everything, paternal age, rather-know uncertainty,
    // happy to wait — a profile that without the bias would tie on scope
    // between KNOVA and Complete Plus. Must land on KNOVA.
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
    // Complete Plus should still appear as the alternative, with the
    // counselling-angle trade-off copy.
    expect(r.alsoConsider?.test.id).toBe("prenatalsafe-complete-plus");
    expect(r.alsoConsider!.tradeOff.toLowerCase()).toMatch(/counselling|conversation|follow-up/);
    // "Preferred KNOVA over Complete Plus" bullet is surfaced.
    const whyText = r.primary!.whyBullets.join(" ").toLowerCase();
    expect(whyText).toContain("prefer knova");
  });

  it("twin pregnancy still gets Complete Plus (eligibility > clinical bias)", () => {
    const r = recommend({
      gestationalAge: "10-plus",
      pregnancyType: "twin",
      conception: "ivf-own-eggs",
      motivation: "max-info",
      historyFlags: ["none"],
      uncertainty: "rather-know",
      speed: "happy-to-wait",
    });
    expect(r.primary?.test.id).toBe("prenatalsafe-complete-plus");
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

  it("never recommends an ineligible test for a twin pregnancy", () => {
    const r = recommend({
      gestationalAge: "10-plus",
      pregnancyType: "twin",
      conception: "natural",
      motivation: "max-info",
      uncertainty: "rather-know",
      speed: "happy-to-wait",
    });
    expect(r.primary?.test.id).toBe("prenatalsafe-complete-plus");
  });

  it("never recommends an ineligible test for a donor-egg pregnancy", () => {
    const r = recommend({
      gestationalAge: "10-plus",
      pregnancyType: "singleton",
      conception: "donor-egg",
      motivation: "reassurance-main",
      uncertainty: "fewer-false-alarms",
      speed: "within-2-weeks",
    });
    expect(r.primary?.test.id).toBe("prenatalsafe-complete-plus");
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
