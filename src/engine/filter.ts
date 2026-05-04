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
    if (t.recommendable === false) {
      ineligibleReasons[id] = "Not currently recommended through this tool — book a midwife consult.";
      continue;
    }
    const reason = firstIneligibilityReason(t, answers);
    if (reason) {
      ineligibleReasons[id] = reason;
    } else {
      eligibleTests.push(id);
    }
  }

  // Twin / donor egg / surrogate pregnancies have no validated test in our
  // recommendable set (Complete Plus is the only option but we don't
  // recommend it through this tool). Route to midwife.
  const noValidatedOption =
    answers.pregnancyType === "twin" ||
    answers.conception === "donor-egg" ||
    answers.conception === "surrogate";

  const routeToMidwife =
    answers.motivation === "high-risk-nhs" ||
    (answers.historyFlags ?? []).includes("previous-affected-pregnancy") ||
    noValidatedOption;

  const routeToMidwifeReason = routeToMidwife
    ? answers.motivation === "high-risk-nhs"
      ? "A high-risk combined-test result needs a clinical conversation before choosing a private NIPT. Please book a midwife call — we can recommend a test during the call."
      : (answers.historyFlags ?? []).includes("previous-affected-pregnancy")
        ? "A previous pregnancy affected by a genetic condition changes the best test for you. Please speak to a midwife first — they'll help you choose."
        : answers.pregnancyType === "twin"
          ? "Twin pregnancies need different test choices than singletons. The tests we offer through this tool aren't validated for twins. Our midwives can walk you through the right options — book a 20-minute consult."
          : answers.conception === "donor-egg"
            ? "Pregnancies conceived with a donor egg need different test choices. The tests we offer through this tool aren't validated for donor-egg pregnancies. Our midwives can walk you through the right options — book a 20-minute consult."
            : answers.conception === "surrogate"
              ? "Surrogacy pregnancies need different test choices. The tests we offer through this tool aren't validated for surrogacy. Our midwives can walk you through the right options — book a 20-minute consult."
              : undefined
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
