import type {
  Answers,
  EligibilityVerdict,
  TestCatalogueEntry,
  TestId,
} from "../types";
import { ALL_TEST_IDS, TESTS } from "../config/tests";

// Pure function: given a partial set of answers, return which tests are still
// eligible, any midwife-priority routing, and any "come back in X weeks" block.
//
// Defensive by design: if we can't tell whether a test is eligible from the
// available answers, we KEEP it in the set (we only remove when an answer
// explicitly rules it out). The safer mistake is under-filtering than
// recommending an ineligible test.
export function filterEligibleTests(answers: Answers): EligibilityVerdict {
  const ineligibleReasons: Partial<Record<TestId, string>> = {};
  const eligibleTests: TestId[] = [];

  for (const id of ALL_TEST_IDS) {
    const t = TESTS[id];
    const reason = firstIneligibilityReason(t, answers);
    if (reason) {
      ineligibleReasons[id] = reason;
    } else {
      eligibleTests.push(id);
    }
  }

  const routeToMidwife =
    answers.motivation === "high-risk-nhs" ||
    (answers.historyFlags ?? []).includes("previous-affected-pregnancy");

  const routeToMidwifeReason = routeToMidwife
    ? answers.motivation === "high-risk-nhs"
      ? "A high-risk combined-test result needs a clinical conversation before choosing a private NIPT. Please book a midwife call — we can recommend a test during the call."
      : "A previous pregnancy affected by a genetic condition changes the best test for you. Please speak to a midwife first — they'll help you choose."
    : undefined;

  const routeToWait = resolveWait(answers);

  return {
    eligibleTests,
    ineligibleReasons: ineligibleReasons as Record<TestId, string | undefined>,
    routeToMidwife,
    routeToMidwifeReason,
    routeToWait,
  };
}

function firstIneligibilityReason(
  test: TestCatalogueEntry,
  a: Answers,
): string | null {
  if (a.pregnancyType && !test.eligibility.allowedPregnancyTypes.includes(a.pregnancyType)) {
    if (a.pregnancyType === "twin")
      return "Not validated for twin pregnancies.";
    if (a.pregnancyType === "vanishing-twin")
      return "Not validated when a vanishing twin has been seen on scan.";
  }
  if (a.conception && !test.eligibility.allowedConceptions.includes(a.conception)) {
    if (a.conception === "donor-egg")
      return "Not validated for donor-egg pregnancies.";
    if (a.conception === "surrogate")
      return "Not validated for surrogacy pregnancies.";
  }
  if (a.gestationalAge === "under-9") {
    return "Too early for NIPT — please come back once you're further along.";
  }
  if (
    a.gestationalAge === "9-to-10" &&
    test.eligibility.minGestationalBand === "10-plus"
  ) {
    return "Needs at least 10 weeks of pregnancy.";
  }
  return null;
}

function resolveWait(answers: Answers): EligibilityVerdict["routeToWait"] {
  if (answers.gestationalAge === "under-9") {
    return {
      weeksToWait: 1,
      reason:
        "NIPT works from 10 weeks of pregnancy (some tests from 9). Please come back when you're a little further along.",
    };
  }
  return undefined;
}
