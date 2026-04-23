import type {
  Answers,
  ScoreBreakdown,
  TestCatalogueEntry,
  TestId,
} from "../types";
import { TESTS } from "../config/tests";
import { WEIGHTS } from "../config/weights";

// Pure scoring function. Each factor returns a 0..1 raw score; we multiply by
// the configured weight and sum. Keeping it normalised makes it easy to tune
// weights without rebalancing every factor.
export function scoreTest(id: TestId, answers: Answers): ScoreBreakdown {
  const t = TESTS[id];

  const scope = rawScopeScore(t, answers) * WEIGHTS.scope;
  const history = rawHistoryScore(t, answers) * WEIGHTS.history;
  const uncertainty = rawUncertaintyScore(t, answers) * WEIGHTS.uncertainty;
  const speed = rawSpeedScore(t, answers) * WEIGHTS.speed;

  return {
    testId: id,
    total: round(scope + history + uncertainty + speed),
    factors: {
      scope: round(scope),
      history: round(history),
      uncertainty: round(uncertainty),
      speed: round(speed),
    },
  };
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

function rawScopeScore(t: TestCatalogueEntry, a: Answers): number {
  switch (a.motivation) {
    case "reassurance-main": {
      // Core aneuploidy trio. Narrow tests win; broader tests still score but
      // lower because patient has expressed preference for "just the basics".
      if (onlyHas(t.scopeTags, ["aneuploidy-13-18-21"])) return 1;
      if (t.scopeTags.includes("aneuploidy-13-18-21") && !t.scopeTags.includes("recessive-carrier")) {
        return 0.5;
      }
      return 0.3;
    }
    case "main-plus-sex": {
      if (t.scopeTags.includes("sex-chromosomes") && !t.scopeTags.includes("expanded-panel")) {
        return 1;
      }
      if (t.scopeTags.includes("sex-chromosomes")) return 0.7;
      return 0.25; // no sex-chromosome coverage — weak match
    }
    case "max-info": {
      // Broader = better, but saturate at 4 tags so Complete Plus doesn't
      // automatically beat KNOVA on scope alone. Once both qualify as "broad",
      // other factors (history, budget, stable sort) decide — and the cheaper
      // focused test tends to win, which is what we want.
      const breadth = Math.min(t.scopeTags.length, 4) / 4;
      return 0.4 + breadth * 0.6;
    }
    case "specific-history": {
      // Tests that broaden into monogenic / carrier territory win; we re-rank
      // further in rawHistoryScore once we know *which* history.
      if (t.scopeTags.includes("de-novo-monogenic") || t.scopeTags.includes("recessive-carrier") || t.scopeTags.includes("genome-wide-cnv")) {
        return 0.85;
      }
      if (t.scopeTags.includes("microdeletions")) return 0.55;
      return 0.3;
    }
    case "high-risk-nhs":
    case undefined: {
      // Default (motivation skipped) — score neutrally by breadth.
      return 0.4 + t.scopeTags.length * 0.05;
    }
  }
}

function rawHistoryScore(t: TestCatalogueEntry, a: Answers): number {
  const flags = a.historyFlags ?? [];
  let s = 0;

  // Paternal age pushes toward de novo monogenic (KNOVA, Complete Plus).
  if (flags.includes("paternal-45-plus")) {
    if (t.scopeTags.includes("de-novo-monogenic")) s += 1;
    else if (t.scopeTags.includes("microdeletions")) s += 0.25;
  } else if (flags.includes("paternal-40-plus")) {
    if (t.scopeTags.includes("de-novo-monogenic")) s += 0.7;
    else if (t.scopeTags.includes("microdeletions")) s += 0.2;
  }

  // Shared ethnic background signals recessive carrier risk → Unity.
  const recessiveBoost =
    (flags.includes("both-partners-ashkenazi") ? 1 : 0) +
    (flags.includes("both-partners-mediterranean") ? 0.8 : 0) +
    (flags.includes("both-partners-sub-saharan") ? 0.8 : 0) +
    (flags.includes("both-partners-south-asian") ? 0.6 : 0) +
    (flags.includes("consanguineous") ? 1 : 0);

  if (recessiveBoost > 0) {
    if (t.scopeTags.includes("recessive-carrier")) s += Math.min(1, recessiveBoost);
    else if (t.scopeTags.includes("genome-wide-cnv")) s += 0.3;
  }

  // Specific known family condition checklist → broader panels help more.
  if (flags.includes("known-family-condition")) {
    if (t.scopeTags.includes("genome-wide-cnv") || t.scopeTags.includes("de-novo-monogenic") || t.scopeTags.includes("recessive-carrier")) {
      s += 0.6;
    } else if (t.scopeTags.includes("microdeletions")) {
      s += 0.3;
    }
  }

  // Maternal 35+ on its own is a neutral signal for aneuploidy tests — all
  // screen the same trisomies. Tiny nudge only.
  if (flags.includes("maternal-35-plus") && t.scopeTags.includes("aneuploidy-13-18-21")) {
    s += 0.05;
  }

  // Normalise into 0..1 (capped).
  return Math.min(1, s);
}

function rawUncertaintyScore(t: TestCatalogueEntry, a: Answers): number {
  const broadTags: TestCatalogueEntry["scopeTags"] = [
    "microdeletions",
    "expanded-panel",
    "genome-wide-cnv",
    "de-novo-monogenic",
  ];
  const isBroad = t.scopeTags.some((tag) => broadTags.includes(tag));

  switch (a.uncertainty) {
    case "fewer-false-alarms":
      return isBroad ? 0.25 : 1;
    case "rather-know":
      return isBroad ? 1 : 0.5;
    case undefined:
      return 0.5;
  }
}

function rawSpeedScore(t: TestCatalogueEntry, a: Answers): number {
  switch (a.speed) {
    case "asap":
      if (t.turnaroundDaysMax <= 5) return 1;
      if (t.turnaroundDaysMax <= 10) return 0.55;
      return 0.1;
    case "within-2-weeks":
      if (t.turnaroundDaysMax <= 14) return 1;
      if (t.turnaroundDaysMax <= 16) return 0.6;
      return 0.15;
    case "happy-to-wait":
      return 1;
    case undefined:
      return 0.7;
  }
}

function onlyHas<T extends string>(arr: readonly T[], allowed: readonly T[]): boolean {
  return arr.length > 0 && arr.every((x) => allowed.includes(x));
}
