import { useCallback, useEffect, useMemo, useRef, useState } from "preact/hooks";
import { useAnalytics } from "./hooks/useAnalytics";
import { useAnswers } from "./hooks/useAnswers";
import { recommend } from "./engine/recommend";
import { QuestionStep } from "./components/QuestionStep";
import { Result } from "./components/Result";
import { Progress } from "./components/Primitives";
import { getTest } from "./config/tests";
import { TOTAL_STAGES, visibleSteps } from "./config/flow";

const BOOKING_URL_DEFAULT = "https://www.jeen.health/book/midwife";
const LEAVE_MS = 160;
const ENTER_MS = 240;

export function App() {
  const { answers, stepIndex, update, goToStep, reset } = useAnswers();
  const { send, sinceStart } = useAnalytics();

  const steps = useMemo(() => visibleSteps(answers), [answers]);
  const clampedStep = Math.min(stepIndex, steps.length);
  const showResult = clampedStep >= steps.length;
  const currentStep = !showResult ? steps[clampedStep] : undefined;

  // ── Transition state machine: idle → leaving → entering → idle.
  // Split into three small effects so each phase's timer has its own
  // dependency footprint and can't be cancelled by an unrelated re-render.
  const [displayedIndex, setDisplayedIndex] = useState(clampedStep);
  const [phase, setPhase] = useState<"entering" | "idle" | "leaving">("idle");

  // Trigger leave when the real step index diverges from what we're showing.
  useEffect(() => {
    if (displayedIndex !== clampedStep && phase !== "leaving") {
      setPhase("leaving");
    }
  }, [clampedStep, displayedIndex, phase]);

  // After the leave animation, swap the displayed step and start entering.
  useEffect(() => {
    if (phase !== "leaving") return;
    const t = window.setTimeout(() => {
      setDisplayedIndex(clampedStep);
      setPhase("entering");
    }, LEAVE_MS);
    return () => window.clearTimeout(t);
  }, [phase, clampedStep]);

  // After the enter animation plays, settle back to idle.
  useEffect(() => {
    if (phase !== "entering") return;
    const t = window.setTimeout(() => setPhase("idle"), ENTER_MS);
    return () => window.clearTimeout(t);
  }, [phase]);

  const displayedStep = displayedIndex < steps.length ? steps[displayedIndex] : undefined;
  const displayedIsResult = displayedIndex >= steps.length;

  // Analytics
  useEffect(() => {
    send({ type: "started" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!currentStep) return;
    send({ type: "stage_entered", stage: currentStep.stage });
  }, [currentStep?.id, send]); // eslint-disable-line react-hooks/exhaustive-deps

  const recommendation = useMemo(() => (showResult ? recommend(answers) : null), [showResult, answers]);
  useEffect(() => {
    if (!recommendation) return;
    send({
      type: "recommended",
      primary: recommendation.primary?.test.id,
      alsoConsider: recommendation.alsoConsider?.test.id,
      shortCircuit: recommendation.shortCircuit?.kind,
      durationMs: sinceStart(),
    });
  }, [recommendation, send, sinceStart]);

  // Refs that always point at the latest answers + stepIndex. Needed because
  // the auto-advance timer in QuestionStep captures `advance` at click time,
  // ~280ms before it fires — by which point closing over `answers` directly
  // would read a stale snapshot taken before the click's onChange landed.
  // Updated inline in the render body (not via useEffect) so the ref is
  // current the moment React commits, before any timers can fire.
  const answersRef = useRef(answers);
  const stepIndexRef = useRef(stepIndex);
  answersRef.current = answers;
  stepIndexRef.current = stepIndex;

  // Advancing to the next step, with short-circuit handling for cases where
  // we shouldn't bother asking more questions. Reads fresh state via refs
  // so the function reference is stable across renders.
  const advance = useCallback(() => {
    const a = answersRef.current;
    const idx = stepIndexRef.current;
    const visible = visibleSteps(a);
    const current = idx < visible.length ? visible[idx] : undefined;

    if (current) {
      send({ type: "stage_answered", stage: current.stage, answer: snapshotForStep(current.id, a) });
    }

    // Short-circuit conditions:
    //   - Gestational age too early → wait screen.
    //   - High-risk NHS combined / previous affected pregnancy → midwife.
    //   - Eligibility-forced cases (twin, vanishing-twin, donor egg, surrogate)
    //     → only one test is possible, so asking the rest is wasted time.
    const shouldShortCircuit =
      a.gestationalAge === "under-9" ||
      a.motivation === "high-risk-nhs" ||
      (a.historyFlags ?? []).includes("previous-affected-pregnancy") ||
      a.pregnancyType === "twin" ||
      a.pregnancyType === "vanishing-twin" ||
      a.conception === "donor-egg" ||
      a.conception === "surrogate";

    goToStep(shouldShortCircuit ? visible.length : idx + 1);
  }, [send, goToStep]);

  const goBack = () => {
    if (clampedStep === 0) return;
    goToStep(clampedStep - 1);
  };

  // Booking / override / restart
  const resolveBookingUrl = (testId?: string) => {
    const base =
      typeof window !== "undefined"
        ? window.__niptSelectorConfig?.bookingUrl ?? BOOKING_URL_DEFAULT
        : BOOKING_URL_DEFAULT;
    if (!testId) return base;
    const url = new URL(base, typeof window !== "undefined" ? window.location.href : "https://www.jeen.health");
    url.searchParams.set("nipt", testId);
    return url.toString();
  };

  const bookMidwife = () => {
    const testId = recommendation?.primary?.test.id;
    send({ type: "cta_clicked", cta: "book-midwife" });
    if (typeof window !== "undefined") window.location.href = resolveBookingUrl(testId);
  };

  const overrideTo = (to: string) => {
    const from = recommendation?.primary?.test.id ?? "";
    send({ type: "override_clicked", from, to });
    const t = getTest(to as Parameters<typeof getTest>[0]);
    if (typeof window !== "undefined") {
      window.location.href = `https://www.jeen.health/nipt/${t.id}`;
    }
  };

  return (
    <div className="nipt-selector">
      {!displayedIsResult && displayedStep && (
        <Progress stage={displayedStep.stage - 1} totalStages={TOTAL_STAGES} />
      )}

      <div className="nipt-stage-container">
        {!displayedIsResult && displayedStep && (
          <QuestionStep
            key={displayedStep.id}
            step={displayedStep}
            answers={answers}
            onChange={update}
            onAdvance={advance}
            onBack={displayedIndex > 0 ? goBack : undefined}
            phase={phase}
          />
        )}

        {displayedIsResult && recommendation && (
          <div className={`nipt-step is-${phase}`}>
            <Result
              answers={answers}
              recommendation={recommendation}
              onRestart={() => {
                send({ type: "cta_clicked", cta: "restart" });
                reset();
              }}
              onOverride={overrideTo}
              onBookMidwife={bookMidwife}
            />
          </div>
        )}
      </div>
    </div>
  );
}

function snapshotForStep(stepId: string, a: ReturnType<typeof useAnswers>["answers"]): Record<string, unknown> {
  switch (stepId) {
    case "weeks":
      return { gestationalAge: a.gestationalAge };
    case "type":
      return { pregnancyType: a.pregnancyType };
    case "conception":
      return { conception: a.conception };
    case "motivation":
      return { motivation: a.motivation };
    case "history":
      return { historyFlags: a.historyFlags };
    case "conditions":
      return { familyConditions: a.familyConditions, notes: a.familyConditionNotes };
    case "uncertainty":
      return { uncertainty: a.uncertainty };
    case "speed":
      return { speed: a.speed };
    default:
      return {};
  }
}
