import type { Answers, Recommendation } from "../types";
import { Callout } from "./Primitives";

const GBP = new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 });
const gbp = (n: number) => GBP.format(n);

interface Props {
  answers: Answers;
  recommendation: Recommendation;
  onRestart: () => void;
  onOverride: (to: string) => void;
  onBookMidwife: () => void;
}

const MIDWIFE_COPY = "Confirm your choice with a midwife — £50, deducted from your test.";

export function Result({ answers, recommendation: r, onRestart, onOverride, onBookMidwife }: Props) {
  // Short-circuit routing first — these override the normal result layout.
  if (r.shortCircuit?.kind === "wait") {
    return (
      <section className="nipt-result">
        <div className="nipt-result__header">
          <div className="nipt-result__kicker">Come back in a few weeks</div>
          <h2 className="nipt-result__title">NIPT is a little early for you right now</h2>
        </div>
        <Callout tone="info">{r.shortCircuit.reason}</Callout>
        <div className="nipt-cta-row">
          <button type="button" className="nipt-btn nipt-btn--primary" onClick={onBookMidwife}>
            Book a midwife call anyway
          </button>
          <button type="button" className="nipt-btn nipt-btn--ghost" onClick={onRestart}>
            Start over
          </button>
        </div>
      </section>
    );
  }

  if (r.shortCircuit?.kind === "midwife") {
    return (
      <section className="nipt-result">
        <div className="nipt-result__header">
          <div className="nipt-result__kicker">Let's speak first</div>
          <h2 className="nipt-result__title">This one needs a conversation, not a form</h2>
        </div>
        <Callout tone="warn">{r.shortCircuit.reason}</Callout>
        <p className="nipt-result__note">
          {MIDWIFE_COPY} The midwife will walk you through your history and recommend the right test for you — faster than guessing from a form.
        </p>
        <div className="nipt-cta-row">
          <button type="button" className="nipt-btn nipt-btn--primary" onClick={onBookMidwife}>
            Book a midwife call
          </button>
          <button type="button" className="nipt-btn nipt-btn--ghost" onClick={onRestart}>
            Start over
          </button>
        </div>
      </section>
    );
  }

  // Standard recommendation layout.
  if (!r.primary) {
    return (
      <section className="nipt-result">
        <h2 className="nipt-result__title">Something went wrong</h2>
        <p>We couldn't work out a recommendation. Please book a midwife call.</p>
        <div className="nipt-cta-row">
          <button type="button" className="nipt-btn nipt-btn--primary" onClick={onBookMidwife}>
            Book a midwife call
          </button>
        </div>
      </section>
    );
  }

  const t = r.primary.test;

  const isVanishingTwin = answers.pregnancyType === "vanishing-twin";

  return (
    <section className="nipt-result">
      {isVanishingTwin && (
        <div className="nipt-banner nipt-banner--warn" role="alert">
          <strong>Important — vanishing twin timing rule.</strong>
          <p>This test must be done <strong>at least 5 weeks after</strong> the vanishing twin was seen on ultrasound. If it's been less than 5 weeks, please wait and book afterwards. Your midwife will confirm timing before the test goes ahead.</p>
        </div>
      )}
      <div className="nipt-result__header">
        <div className="nipt-result__kicker">We recommend</div>
        <h2 className="nipt-result__title">{t.name}</h2>
        <div className="nipt-result__meta">
          <span className="nipt-result__price">{gbp(t.price)}</span>
          <span className="nipt-result__dot" aria-hidden="true">·</span>
          <span className="nipt-result__tat">Results in {t.turnaroundLabel}</span>
        </div>
        <p className="nipt-result__scope">{t.scope}</p>
      </div>

      <div className="nipt-result__why">
        <h3>Why this test for you</h3>
        <ul>
          {r.primary.whyBullets.map((b, i) => (
            <li key={i}>{b}</li>
          ))}
        </ul>
      </div>

      {r.alsoConsider && (
        <div className="nipt-also">
          <h3>Also worth considering</h3>
          <div className="nipt-also__card">
            <div className="nipt-also__name">{r.alsoConsider.test.name}</div>
            <div className="nipt-also__meta">
              {gbp(r.alsoConsider.test.price)} · Results in {r.alsoConsider.test.turnaroundLabel}
            </div>
            <p className="nipt-also__tradeoff">{r.alsoConsider.tradeOff}</p>
            <button
              type="button"
              className="nipt-btn nipt-btn--ghost nipt-btn--sm"
              onClick={() => onOverride(r.alsoConsider!.test.id)}
            >
              Prefer this one
            </button>
          </div>
        </div>
      )}

      <div className="nipt-caveats">
        <h3>A few things to know</h3>
        <ul>
          {r.caveats.slice(0, 4).map((c, i) => (
            <li key={i}>{c}</li>
          ))}
        </ul>
      </div>

      <div className="nipt-midwife">
        <div className="nipt-midwife__body">
          <strong>Your midwife will confirm this is right for you.</strong>
          <p>{MIDWIFE_COPY}</p>
        </div>
        <button type="button" className="nipt-btn nipt-btn--primary" onClick={onBookMidwife}>
          Book the midwife call
        </button>
      </div>

      <div className="nipt-footer-actions">
        <button type="button" className="nipt-btn nipt-btn--ghost nipt-btn--sm" onClick={onRestart}>
          Start over
        </button>
      </div>

      <p className="nipt-disclaimer">
        This tool is a preference guide, not medical advice. All NIPT tests screen baby's DNA — they don't diagnose. A positive result always needs follow-up testing to confirm. NIPT does not detect structural differences (that's what your 12- and 20-week scans are for).
      </p>
    </section>
  );
}
