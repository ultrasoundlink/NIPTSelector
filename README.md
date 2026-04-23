# NIPT Selector

A 4-stage guided tool that helps Jeen Health patients pick between our 8 NIPT
tests. Takes someone who knows they want "an NIPT" but can't choose, and in
2–3 minutes lands them on a primary recommendation with a plain-English "why"
and a midwife-consult CTA.

> **This is a preference tool, not medical advice.** The output screen always
> ends with "Your midwife will confirm this is right for you" and the booking
> CTA carries the selected test ID into Semble via query string.

## What's in the box

- **8-test catalogue** (`src/config/tests.ts`) — source of truth for prices,
  turnaround, scope tags, eligibility rules and result-screen caveats.
- **Eligibility filter** (`src/engine/filter.ts`) — hard rules that remove
  ineligible tests before scoring. Twins / donor eggs / surrogacy leave only
  PrenatalSafe Complete Plus eligible; this is by design.
- **Scoring engine** (`src/engine/score.ts`) — pure function that scores each
  eligible test across five weighted factors: scope match (×3), family history
  alignment (×3), uncertainty preference (×2), speed (×2), budget proximity
  (×1). Weights live in `src/config/weights.ts` so they can be tuned without
  touching code.
- **4-stage UI** — pregnancy facts → motivation → family history →
  preferences. Mobile-first, keyboard- and screen-reader-accessible, all
  styles scoped under `.nipt-selector` so it can't leak into Webflow.
- **Gold-standard tests** (`src/engine/__tests__/recommend.test.ts`) — 15
  cases locking the scoring weights. Run these before merging any tuning
  change.

## Local development

```bash
npm install
npm run dev         # localhost:5173
npm test            # run unit tests once
npm run test:watch  # TDD mode
npm run typecheck   # types only
```

## Building

Two output modes:

```bash
npm run build        # dist/   — separate nipt-selector.js + .css for CDN hosting
npm run build:embed  # dist-embed/index.html — single self-contained HTML file
```

The regular build is ~48 kB JS + 8 kB CSS (~17 kB gzipped). The embed build is
~57 kB (~18 kB gzipped) all inlined.

## Webflow embed — two paths

### Option A — host on a CDN (recommended)

1. Run `npm run build` and upload `dist/nipt-selector.js` and
   `dist/nipt-selector.css` to any static host (Cloudflare Pages, Netlify,
   Vercel, or even an S3 bucket).
2. On the Jeen Webflow page, add an **Embed** element with:

```html
<div id="nipt-selector"></div>
<link rel="stylesheet" href="https://YOUR_CDN/nipt-selector.css">
<script type="module" src="https://YOUR_CDN/nipt-selector.js"></script>
<script>
  window.__niptSelectorConfig = {
    bookingUrl: "https://www.jeen.health/book/midwife",
    analyticsEndpoint: "https://YOUR_WORKER.workers.dev/events"
  };
</script>
```

Ship updates by redeploying to the CDN — no Webflow touchpoint.

### Option B — paste the single-file build directly

1. Run `npm run build:embed`.
2. Open `dist-embed/index.html`, copy everything inside `<body>` (the mount
   `<div>`, the inline `<style>` and the inline `<script>`).
3. Paste into a Webflow Embed element. Configure via the same
   `window.__niptSelectorConfig` snippet above, placed just before the
   bundle's `<script>`.

Updating means re-pasting the new bundle, so Option A is less painful for
iteration.

## Runtime config

The bundle reads `window.__niptSelectorConfig` (optional):

```ts
window.__niptSelectorConfig = {
  // Where to send the patient on "Book the midwife call". The selected test
  // ID is appended as ?nipt=<id> so Semble can pre-fill.
  bookingUrl?: string;

  // If set, events are POSTed as JSON via sendBeacon.
  analyticsEndpoint?: string;
};
```

If `window.dataLayer` exists (as on most Webflow sites with GTM), events are
also pushed there with `event: "nipt_<type>"`.

## Analytics events

Captured from day one so you can iterate on scoring weights:

| Event               | Fired when                                             |
| ------------------- | ------------------------------------------------------ |
| `nipt_started`      | Tool mounts                                            |
| `nipt_stage_entered`| Any stage (0–4) renders                                |
| `nipt_stage_answered` | User clicks Continue on a stage; payload = answers   |
| `nipt_recommended`  | Result screen renders; payload = primary, also-consider, shortCircuit kind, duration |
| `nipt_cta_clicked`  | `book-midwife` / `restart`                             |
| `nipt_override_clicked` | User picks "also consider" over the primary         |

**Metrics to watch:**
- Drop-off at each stage (most important)
- Distribution of recommendations — if 80% land on Panorama Basic, either the
  weights need tuning or your traffic really is that uniform
- Override rate — if patients routinely flip to the also-consider, the
  scoring doesn't match their preferences
- Time to complete — optimise the slowest stage

## Tuning the scoring

1. Change a weight in `src/config/weights.ts` or a raw factor in
   `src/engine/score.ts`.
2. `npm test` — the 15 gold-standard cases will fail loudly if your change
   breaks a known-good profile.
3. If a golden case legitimately should flip because you've made a clinical
   decision change, update the case in `recommend.test.ts` with a comment
   explaining why.

Add new golden cases whenever Fred or the midwives disagree with a live
recommendation — each one future-proofs your weights against drift.

## Updating the test catalogue

Prices and turnarounds change. All edits happen in `src/config/tests.ts`:

- `price`, `turnaroundLabel`, `turnaroundDaysMax`, `scope`, `caveats` — free
  to change, no engine impact.
- `eligibility.allowedPregnancyTypes` / `allowedConceptions` — changes hard
  filter behaviour. Re-run tests.
- `scopeTags` — feeds scoring. Re-run tests and verify golden cases still
  pick the test you expect.
- `budgetBand` — keep in sync with the bands in
  `src/components/Stage4Preferences.tsx`.

Adding a 9th test: extend the `TestId` union in `src/types.ts`, add the entry
to `TESTS`, and add at least one golden case that exercises it.

## Clinical governance

Before going live:

1. Fred and the midwives should review the decision logic: walk through each
   motivation × history combination in `src/engine/__tests__/recommend.test.ts`
   and sign off on the primary recommendations.
2. The result-screen copy in `src/engine/recommend.ts` (`buildWhyBullets`)
   and `src/components/Result.tsx` names tests and makes claims about scope —
   treat it like clinical copy.
3. The "NIPT is a screening test, not a diagnostic test" disclaimer on the
   result screen is baseline — don't remove it.
4. The "previous-affected-pregnancy" and "high-risk-nhs" paths short-circuit
   straight to a midwife call mid-flow, before the preference questions.
   Keep that behaviour.
5. Any ambiguous eligibility case should default to Complete Plus or the
   midwife short-circuit, never to one of the narrower tests.

## File layout

```
src/
  types.ts                         # Answers, TestCatalogueEntry, Recommendation
  config/
    tests.ts                       # 8 test catalogue (source of truth)
    weights.ts                     # Scoring weights + also-consider margin
  engine/
    filter.ts                      # Hard eligibility rules
    score.ts                       # Pure scoring (0..1 per factor × weight)
    recommend.ts                   # Orchestrates filter + score + why-bullets
    __tests__/recommend.test.ts    # Gold-standard cases
  components/
    Primitives.tsx                 # OptionCard, Progress, Nav, etc.
    Stage1Pregnancy.tsx            # Eligibility-filter stage
    Stage2Motivation.tsx           # Motivation single-select
    Stage3History.tsx              # Multi-select history + conditions
    Stage4Preferences.tsx          # Uncertainty / speed / budget
    Result.tsx                     # Recommendation, also-consider, CTA
  hooks/
    useAnswers.ts                  # URL-backed answer state
    useAnalytics.ts                # dataLayer + beacon dispatcher
  styles/app.css                   # Scoped .nipt-selector styles
  App.tsx                          # Flow orchestration + short-circuits
  main.tsx                         # Mount into #nipt-selector
```

## Known risks

- **Clinical liability.** The tool makes test recommendations. Mitigated by
  (a) the "preference tool, not medical advice" framing on the result screen,
  (b) the midwife consult CTA before any purchase, (c) Fred/midwives signing
  off on the decision logic before launch.
- **Eligibility misses.** Recommending Panorama to a twin pregnancy is worse
  than being too conservative. The filter defaults to "exclude unless
  explicitly allowed" for each test and the Complete Plus fallback exists for
  twin/donor/surrogate cases.
- **Over-recommending the expensive option.** Scoring caps scope breadth at 4
  tags for `max-info` so Complete Plus doesn't automatically win on breadth
  over KNOVA. Monitor the recommendation distribution and the override rate
  after launch.
- **Edge cases** (known affected previous pregnancy, positive NHS screen,
  ambiguous family history) — all short-circuit straight to midwife. Do not
  loosen this without clinical sign-off.
