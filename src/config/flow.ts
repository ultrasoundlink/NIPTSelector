import type { Answers } from "../types";

// Flat list of typeform-style steps. The UI walks through these one at a
// time with enter/leave transitions. Single-choice steps auto-advance on
// selection; multi-choice steps show a Continue button.
//
// Conditional steps (those with `showIf`) are skipped when the predicate
// returns false. `visibleSteps(answers)` computes the filtered list.

type SingleField =
  | "gestationalAge"
  | "pregnancyType"
  | "conception"
  | "motivation"
  | "uncertainty"
  | "speed";

export interface SingleChoiceOption {
  value: string;
  title: string;
  description?: string;
  tag?: string;
}

export interface SingleChoiceStep {
  kind: "single";
  id: string;
  stage: 1 | 2 | 3 | 4;
  field: SingleField;
  title: string;
  subtitle?: string;
  hint?: string;
  options: SingleChoiceOption[];
  autoAdvance?: boolean;
}

export interface HistoryStep {
  kind: "history";
  id: "history";
  stage: 3;
  title: string;
  subtitle?: string;
}

export interface ConditionsStep {
  kind: "conditions";
  id: "conditions";
  stage: 3;
  title: string;
  subtitle?: string;
  showIf: (a: Answers) => boolean;
}

export type Step = SingleChoiceStep | HistoryStep | ConditionsStep;

export const STEPS: Step[] = [
  // Stage 1 — pregnancy basics (hard filters)
  {
    kind: "single",
    id: "weeks",
    stage: 1,
    field: "gestationalAge",
    title: "How many weeks pregnant are you?",
    hint: "NIPT works from around 10 weeks — some tests from 9.",
    autoAdvance: true,
    options: [
      { value: "under-9", title: "Under 9 weeks", description: "We'll ask you to come back once you're a little further along." },
      { value: "9-to-10", title: "9 to 10 weeks" },
      { value: "10-plus", title: "10 weeks or more" },
    ],
  },
  {
    kind: "single",
    id: "type",
    stage: 1,
    field: "pregnancyType",
    title: "Is it a singleton or twin pregnancy?",
    autoAdvance: true,
    options: [
      { value: "singleton", title: "Singleton" },
      { value: "twin", title: "Twins", description: "Only one test in our range is validated for twin pregnancies." },
      { value: "vanishing-twin", title: "Vanishing twin seen on scan" },
    ],
  },
  {
    kind: "single",
    id: "conception",
    stage: 1,
    field: "conception",
    title: "How was this pregnancy conceived?",
    autoAdvance: true,
    options: [
      { value: "natural", title: "Naturally" },
      { value: "ivf-own-eggs", title: "IVF with your own eggs" },
      { value: "donor-egg", title: "IVF with a donor egg", description: "This narrows the test options — we'll explain why on the result screen." },
      { value: "surrogate", title: "Via a surrogate" },
    ],
  },

  // Stage 2 — motivation
  {
    kind: "single",
    id: "motivation",
    stage: 2,
    field: "motivation",
    title: "What's most important to you?",
    subtitle: "Your reason for testing shapes which test is the right fit.",
    autoAdvance: true,
    options: [
      { value: "reassurance-main", title: "Reassurance on the main conditions", description: "Down's, Edwards' and Patau's syndromes (trisomies 21, 18 and 13)." },
      { value: "main-plus-sex", title: "The main conditions plus baby's sex", description: "Adds sex chromosome conditions and includes baby's sex." },
      { value: "max-info", title: "As much information about baby's health as possible", description: "Broadest panels — more findings, but also more follow-up conversations." },
      { value: "specific-history", title: "I have a specific family history or concern", description: "We'll ask a couple more questions to tailor the recommendation." },
      { value: "high-risk-nhs", title: "I had a high-risk NHS combined test result", description: "This one needs a conversation — we'll route you straight to a midwife.", tag: "Midwife first" },
    ],
  },

  // Stage 3 — history (multi-select, manual Continue)
  {
    kind: "history",
    id: "history",
    stage: 3,
    title: "Anything in your or your partner's family history?",
    subtitle: "Pick anything that applies — or choose 'none of the above'.",
  },
  {
    kind: "conditions",
    id: "conditions",
    stage: 3,
    title: "Which condition or conditions?",
    subtitle: "Tick any that apply so we can factor them in.",
    showIf: (a) => (a.historyFlags ?? []).includes("known-family-condition"),
  },

  // Stage 4 — preferences
  {
    kind: "single",
    id: "uncertainty",
    stage: 4,
    field: "uncertainty",
    title: "How do you feel about false alarms?",
    hint: "Some broader tests can flag rare conditions that turn out to be benign after follow-up.",
    autoAdvance: true,
    options: [
      { value: "rather-know", title: "I'd rather know, even if some flags turn out to be false" },
      { value: "fewer-false-alarms", title: "I prefer fewer false alarms, even if it means a narrower test" },
    ],
  },
  {
    kind: "single",
    id: "speed",
    stage: 4,
    field: "speed",
    title: "How soon do you need results?",
    autoAdvance: true,
    options: [
      { value: "asap", title: "As soon as possible", description: "Inside a working week where available." },
      { value: "within-2-weeks", title: "Within 2 weeks" },
      { value: "happy-to-wait", title: "I'm happy to wait for the right test" },
    ],
  },
];

export function visibleSteps(a: Answers): Step[] {
  return STEPS.filter((s) => !("showIf" in s) || s.showIf(a));
}

export const TOTAL_STAGES = 4;
