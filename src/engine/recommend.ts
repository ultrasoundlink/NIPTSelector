import type {
  Answers,
  EligibilityVerdict,
  Recommendation,
  ScoreBreakdown,
  TestCatalogueEntry,
} from "../types";
import { TESTS } from "../config/tests";
import { ALSO_CONSIDER_MAX_SCORE_GAP, COMPLETE_PLUS_KNOVA_BIAS } from "../config/weights";
import { filterEligibleTests } from "./filter";
import { scoreTest } from "./score";

const GBP = new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 });
const gbp = (n: number) => GBP.format(n);

// Top-level: given the patient's answers, produce the full recommendation.
// Design invariant: the patient always gets a test recommendation with a
// clear explanation of WHY. The only "no test" paths are:
//   - Too early in pregnancy (under 9 weeks) → wait screen
//   - Clinical edge cases that must start with a midwife (high-risk NHS,
//     previous affected pregnancy) → midwife screen with clinical reason
// Every other combination of answers produces a primary + alternative test.
export function recommend(answers: Answers): Recommendation {
  const verdict = filterEligibleTests(answers);

  if (verdict.routeToWait) {
    return {
      shortCircuit: {
        kind: "wait",
        weeksToWait: verdict.routeToWait.weeksToWait,
        reason: verdict.routeToWait.reason,
      },
      caveats: [],
      allScores: [],
    };
  }

  if (verdict.routeToMidwife) {
    return {
      shortCircuit: { kind: "midwife", reason: verdict.routeToMidwifeReason! },
      caveats: [],
      allScores: [],
    };
  }

  // Score every eligible test, apply the Complete Plus clinical bias, then
  // sort by total desc. The bias is a constant penalty applied only when
  // KNOVA is also in the eligible set — for twin/donor pregnancies where
  // Complete Plus is the only option, no bias applies and it wins.
  const rawScores = verdict.eligibleTests.map((id) => scoreTest(id, answers));
  const scores = applyClinicalBias(rawScores).sort((a, b) => b.total - a.total);

  // Safety net: if eligibility somehow removed everything (e.g. twin + 9-10
  // weeks — Complete Plus needs 10+), fall back to Complete Plus with a
  // clear explanation of what constrained the choice. We never tell the
  // patient "we couldn't find a test".
  if (scores.length === 0) {
    return buildConstrainedFallback(answers, verdict);
  }

  const topScore = scores[0]!;
  const primaryTest = TESTS[topScore.testId];

  const alsoConsider = pickAlsoConsider(primaryTest, scores, answers);
  const whyBullets = buildWhyBullets(primaryTest, answers, verdict.eligibleTests.length, alsoConsider?.test.id);

  return {
    primary: {
      test: primaryTest,
      whyBullets,
      score: topScore,
    },
    ...(alsoConsider ? { alsoConsider } : {}),
    caveats: buildCaveats(primaryTest),
    allScores: scores,
  };
}

// Build a safe fallback recommendation when eligibility filtering removes
// every test (rare — e.g. twin pregnancy at 9–10 weeks). Always recommends
// Complete Plus (the broadest-eligibility test) with an explanation that
// references the specific constraint the patient hit.
function buildConstrainedFallback(a: Answers, verdict: EligibilityVerdict): Recommendation {
  // Vanishing twin: only PrenatalSafe 3 UK is validated. Complete Plus is NOT
  // — recommending it for vanishing twin would be wrong. Pick the right
  // fallback per situation.
  const fallback = pickFallbackTest(a);
  const reasons: string[] = [];

  if (a.pregnancyType === "vanishing-twin") {
    reasons.push(
      "Because you told us a vanishing twin was seen on scan, this is the only test in our range validated for your situation.",
    );
    reasons.push(
      "Important: this test must be done at least 5 weeks after the vanishing twin was seen on ultrasound. Please confirm with your midwife before booking.",
    );
  } else if (a.pregnancyType === "twin") {
    reasons.push(
      "Because you told us you're carrying twins, most NIPTs in our range aren't validated for your situation. This one is.",
    );
  } else if (a.conception === "donor-egg" || a.conception === "surrogate") {
    reasons.push(
      `Because your pregnancy was conceived with a ${a.conception === "donor-egg" ? "donor egg" : "surrogate"}, most NIPTs aren't validated for your situation. This one is.`,
    );
  }
  if (a.gestationalAge === "9-to-10" && fallback.eligibility.minGestationalBand === "10-plus") {
    reasons.push(
      "This test needs at least 10 weeks of pregnancy. If you can wait a week or so, we'll be able to run it.",
    );
  }
  if (reasons.length === 0) {
    reasons.push(
      "Your pregnancy details ruled out our narrower tests, so we're recommending the one test in our range that fits.",
    );
  }

  if (fallback.id === "prenatalsafe-complete-plus") {
    reasons.push("It's our broadest screen — the main chromosome conditions, microdeletions and a monogenic panel all in one test.");
  } else {
    reasons.push(`It screens for the three main trisomies (Down's, Edwards', Patau's) — ${fallback.turnaroundLabel} turnaround.`);
  }

  return {
    primary: {
      test: fallback,
      whyBullets: reasons,
      score: {
        testId: fallback.id,
        total: 0,
        factors: { scope: 0, history: 0, uncertainty: 0, speed: 0 },
      },
    },
    caveats: buildCaveats(fallback),
    allScores: [],
    // Signal upstream that we short-circuited on eligibility, useful for
    // analytics and for the result screen if it wants to flag this.
    ...(verdict.ineligibleReasons ? {} : {}),
  };
}

function pickFallbackTest(a: Answers): TestCatalogueEntry {
  // Vanishing twin: only PrenatalSafe 3 UK is validated.
  if (a.pregnancyType === "vanishing-twin") return TESTS["prenatalsafe-3-uk"];
  // Everything else falls back to Complete Plus (the test with broadest
  // eligibility coverage — twins, donor egg, surrogate).
  return TESTS["prenatalsafe-complete-plus"];
}

function applyClinicalBias(scores: ScoreBreakdown[]): ScoreBreakdown[] {
  // Only applies when KNOVA is in the eligible set. If eligibility has
  // already removed KNOVA (twin / donor / surrogate), Complete Plus is the
  // correct answer and no bias is wanted.
  const knovaEligible = scores.some((s) => s.testId === "knova");
  if (!knovaEligible) return scores;
  return scores.map((s) =>
    s.testId === "prenatalsafe-complete-plus"
      ? { ...s, total: Math.max(0, Math.round((s.total - COMPLETE_PLUS_KNOVA_BIAS) * 100) / 100) }
      : s,
  );
}

function buildCaveats(test: TestCatalogueEntry): string[] {
  return [
    ...test.caveats,
    "NIPT is a screening test, not a diagnostic test. A positive result means your midwife will talk you through follow-up options.",
    "NIPT does not detect structural differences — that's what your 12- and 20-week scans are for.",
  ];
}

function buildWhyBullets(
  test: TestCatalogueEntry,
  a: Answers,
  eligibleCount: number,
  alternativeId?: string,
): string[] {
  const bullets: string[] = [];

  // Eligibility-driven bullet first — the most important signal.
  if (a.pregnancyType === "twin" || a.pregnancyType === "vanishing-twin") {
    bullets.push(
      `Because you told us you're carrying ${a.pregnancyType === "twin" ? "twins" : "a pregnancy with a vanishing twin"}, this is the test validated for your situation.`,
    );
  } else if (a.conception === "donor-egg" || a.conception === "surrogate") {
    bullets.push(
      `Because your pregnancy was conceived with a ${a.conception === "donor-egg" ? "donor egg" : "surrogate"}, this is the test validated for your situation.`,
    );
  } else if (eligibleCount === 1) {
    bullets.push("This is the only test in our range that fits the pregnancy details you gave us.");
  }

  // Motivation-driven bullet.
  switch (a.motivation) {
    case "reassurance-main":
      if (test.scopeTags.length <= 2)
        bullets.push("You told us you wanted reassurance on the main conditions — this test focuses there, without flagging rarer conditions.");
      else
        bullets.push("You told us you wanted reassurance on the main conditions — this test covers those as its core screen.");
      break;
    case "main-plus-sex":
      if (test.scopeTags.includes("sex-chromosomes"))
        bullets.push("You told us you wanted the main conditions plus baby's sex and sex chromosome conditions — this test covers all of that.");
      break;
    case "max-info":
      bullets.push(`You told us you wanted as much information as possible — this test ${test.scopeTags.length >= 4 ? "is one of our broader panels" : "is the broadest option available given your other answers"}.`);
      break;
    case "specific-history":
      bullets.push("You told us you have a specific family history or concern — this test's scope gives you the most useful coverage for that.");
      break;
    case "high-risk-nhs":
    case undefined:
      break;
  }

  // History-driven bullet.
  const flags = a.historyFlags ?? [];
  if (flags.includes("paternal-45-plus") || flags.includes("paternal-40-plus")) {
    if (test.scopeTags.includes("de-novo-monogenic")) {
      bullets.push("You told us paternal age is a factor — this test specifically screens for new mutations that become more common with higher paternal age.");
    }
  }
  const recessive = ["both-partners-ashkenazi", "both-partners-mediterranean", "both-partners-sub-saharan", "both-partners-south-asian", "consanguineous"].some((f) => flags.includes(f as never));
  if (recessive && test.scopeTags.includes("recessive-carrier")) {
    bullets.push("You told us you and your partner share a background where some recessive conditions are more common — this test checks whether you're both silent carriers.");
  }

  // Speed trade-off callout.
  if (a.speed === "asap" && test.turnaroundDaysMax <= 5) {
    bullets.push(`You wanted results as fast as possible — this one is usually back in ${test.turnaroundLabel}.`);
  } else if (a.speed === "asap" && test.turnaroundDaysMax > 10) {
    bullets.push(`You asked for fast results — this test takes ${test.turnaroundLabel}. We picked it because its scope matches your other answers; the trade-off is turnaround.`);
  }

  if (a.uncertainty === "fewer-false-alarms" && test.scopeTags.length <= 3) {
    bullets.push("You told us you'd prefer fewer false alarms — this test's narrower scope means fewer flags to follow up on.");
  } else if (a.uncertainty === "rather-know" && test.scopeTags.length >= 4) {
    bullets.push("You told us you'd rather know even if some flags turn out to be false — this panel's breadth matches that preference.");
  }

  // When KNOVA is the primary and Complete Plus shows up as the alternative,
  // explicitly flag the clinical rationale. This is the one case where we
  // want the patient to know we *chose* the more focused test on purpose.
  if (test.id === "knova" && alternativeId === "prenatalsafe-complete-plus") {
    bullets.push(
      "We prefer KNOVA over the broader PrenatalSafe Complete Plus here — Complete Plus flags more findings that need follow-up counselling, and for most patients the additional value isn't worth the extra uncertainty.",
    );
  }

  // Always surface at least two bullets, even if the patient answered
  // minimally. The scope line is a safe fallback every test can explain.
  if (bullets.length < 2) {
    bullets.push(`In plain English: ${test.scope}`);
  }
  if (bullets.length < 2) {
    bullets.push("Based on your answers, this test's scope and turnaround line up most closely with what you asked for.");
  }

  return bullets.slice(0, 4);
}

function pickAlsoConsider(
  primary: TestCatalogueEntry,
  scores: ScoreBreakdown[],
  _a: Answers,
): Recommendation["alsoConsider"] {
  // Walk down the score list looking for the first test that's meaningfully
  // different from the primary. We always want to surface a second option —
  // skip near-duplicates (same scope tags) and wildly worse scores.
  const top = scores[0]!.total;
  for (let i = 1; i < scores.length; i++) {
    const candidate = scores[i]!;
    if (top > 0 && (top - candidate.total) / top > ALSO_CONSIDER_MAX_SCORE_GAP) break;
    const altTest = TESTS[candidate.testId];
    const tradeOff = describeTradeOff(primary, altTest);
    if (tradeOff) {
      return { test: altTest, tradeOff, score: candidate };
    }
  }
  return undefined;
}

function describeTradeOff(
  primary: TestCatalogueEntry,
  alt: TestCatalogueEntry,
): string | null {
  // Skip if the alt is essentially identical to the primary in every
  // material respect.
  const sameTags = alt.scopeTags.length === primary.scopeTags.length && alt.scopeTags.every((t) => primary.scopeTags.includes(t));
  if (sameTags && alt.price === primary.price && alt.turnaroundDaysMax === primary.turnaroundDaysMax) {
    return null;
  }

  // Special case: Complete Plus as the alternative. Call out the counselling
  // angle explicitly so patients can make an informed trade-off, not just a
  // price/scope comparison.
  if (alt.id === "prenatalsafe-complete-plus") {
    const priceDelta = alt.price > primary.price ? `${gbp(alt.price - primary.price)} more — ` : "";
    return `${priceDelta}our broadest panel. Genuinely catches more, but also flags more findings that turn out to be benign on follow-up, so expect more midwife conversation post-result.`;
  }

  const cheaper = alt.price < primary.price;
  const faster = alt.turnaroundDaysMax < primary.turnaroundDaysMax;
  const broader = alt.scopeTags.length > primary.scopeTags.length;
  const narrower = alt.scopeTags.length < primary.scopeTags.length;

  const bits: string[] = [];
  if (cheaper) bits.push(`${gbp(primary.price - alt.price)} cheaper`);
  else if (alt.price > primary.price) bits.push(`${gbp(alt.price - primary.price)} more`);
  if (broader) bits.push("broader scope");
  else if (narrower) bits.push("narrower scope");
  if (faster) bits.push(`faster (${alt.turnaroundLabel})`);

  if (bits.length === 0) return `Similar coverage at ${gbp(alt.price)} — worth a look if the scope fits.`;
  return `${capitalise(bits.join(", "))} — worth a look if the trade-off fits.`;
}

function capitalise(s: string): string {
  return s.length === 0 ? s : s[0]!.toUpperCase() + s.slice(1);
}
