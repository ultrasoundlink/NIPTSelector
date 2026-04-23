// Shared types across config, engine, and UI.
// All test IDs are string literals so the engine can narrow at compile time.

export type TestId =
  | "aneuploidy-nipt"
  | "prenatalsafe-3-uk"
  | "panorama-basic"
  | "panorama-microdeletions"
  | "niptify"
  | "unity-complete"
  | "knova"
  | "prenatalsafe-complete-plus";

export type PregnancyType = "singleton" | "twin" | "vanishing-twin";

export type ConceptionType =
  | "natural"
  | "ivf-own-eggs"
  | "donor-egg"
  | "surrogate";

export type GestationalBand = "under-9" | "9-to-10" | "10-plus";

export type Motivation =
  | "reassurance-main"
  | "main-plus-sex"
  | "max-info"
  | "specific-history"
  | "high-risk-nhs";

export type HistoryFlag =
  | "maternal-35-plus"
  | "paternal-40-plus"
  | "paternal-45-plus"
  | "previous-affected-pregnancy"
  | "known-family-condition"
  | "both-partners-ashkenazi"
  | "both-partners-mediterranean"
  | "both-partners-sub-saharan"
  | "both-partners-south-asian"
  | "consanguineous"
  | "none";

// Common conditions patients can select when they pick "known-family-condition".
// Used purely for flavor / explanation, not for scoring in v1.
export type FamilyCondition =
  | "digeorge"
  | "cystic-fibrosis"
  | "sma"
  | "thalassaemia"
  | "sickle-cell"
  | "achondroplasia"
  | "fragile-x"
  | "other";

export type UncertaintyPref = "rather-know" | "fewer-false-alarms";
export type SpeedPref = "asap" | "within-2-weeks" | "happy-to-wait";

// Full set of answers the patient has accumulated through the flow.
// Partial until the last stage.
export interface Answers {
  // Stage 1 — pregnancy basics (hard filters)
  gestationalAge?: GestationalBand;
  pregnancyType?: PregnancyType;
  conception?: ConceptionType;
  bmiFlag?: boolean; // optional fetal-fraction risk flag

  // Stage 2 — motivation
  motivation?: Motivation;

  // Stage 3 — history
  historyFlags?: HistoryFlag[];
  familyConditions?: FamilyCondition[]; // only when 'known-family-condition' selected
  familyConditionNotes?: string; // free-text

  // Stage 4 — preferences
  uncertainty?: UncertaintyPref;
  speed?: SpeedPref;
}

export interface TestCatalogueEntry {
  id: TestId;
  name: string;
  shortName: string;
  price: number; // GBP
  turnaroundLabel: string; // human-readable, e.g. "7–10 days"
  turnaroundDaysMax: number; // used for speed scoring
  scope: string; // short plain-English scope line
  scopeTags: ScopeTag[];
  eligibility: EligibilityRules;
  notable?: string; // one-line nuance shown in "also worth knowing"
  caveats: string[]; // bullets for the result screen
}

export type ScopeTag =
  | "aneuploidy-13-18-21"
  | "sex-chromosomes"
  | "triploidy"
  | "microdeletions"
  | "expanded-panel"
  | "recessive-carrier"
  | "de-novo-monogenic"
  | "genome-wide-cnv";

export interface EligibilityRules {
  allowedPregnancyTypes: PregnancyType[];
  allowedConceptions: ConceptionType[];
  minGestationalBand: GestationalBand; // cheapest possible to run
}

export interface RecommendationInput {
  answers: Answers;
}

export interface EligibilityVerdict {
  eligibleTests: TestId[];
  ineligibleReasons: Record<TestId, string | undefined>;
  routeToMidwife: boolean;
  routeToMidwifeReason?: string;
  routeToWait?: { weeksToWait: number; reason: string };
}

export interface ScoreBreakdown {
  testId: TestId;
  total: number;
  factors: {
    scope: number;
    history: number;
    uncertainty: number;
    speed: number;
  };
}

export interface Recommendation {
  // If set, UI should short-circuit with a midwife/wait prompt.
  shortCircuit?:
    | { kind: "midwife"; reason: string }
    | { kind: "wait"; weeksToWait: number; reason: string };
  primary?: {
    test: TestCatalogueEntry;
    whyBullets: string[];
    score: ScoreBreakdown;
  };
  alsoConsider?: {
    test: TestCatalogueEntry;
    tradeOff: string;
    score: ScoreBreakdown;
  };
  caveats: string[];
  allScores: ScoreBreakdown[];
}
