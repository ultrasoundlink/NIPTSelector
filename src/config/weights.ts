// Scoring weights. Kept centralised so they can be tuned from analytics
// without touching the engine itself.
export const WEIGHTS = {
  scope: 3,
  history: 3,
  uncertainty: 2,
  speed: 2,
} as const;

// The second-place test is always shown alongside the primary (we always
// want to offer 2 options), provided the alternative is meaningfully
// different from the primary — not a near-duplicate.
export const ALSO_CONSIDER_MAX_SCORE_GAP = 0.5; // 50% — generous; always surface an alternative unless it's wildly worse

// Clinical bias: Complete Plus is harder to counsel (genome-wide CNVs generate
// more findings that need follow-up conversation). When KNOVA is also eligible
// — singleton + natural/own-eggs + 10+ weeks — prefer KNOVA as the primary
// recommendation. The bias is applied AFTER scoring, so it only breaks close
// ties; big score differences still come through. Complete Plus still surfaces
// as the "also consider" option for patients who want maximum breadth.
export const COMPLETE_PLUS_KNOVA_BIAS = 1.5;

// Telemetry endpoint. Swap this at embed time via window config; defaults to
// a no-op that still logs to console in dev.
export const DEFAULT_ANALYTICS_ENDPOINT = "";
