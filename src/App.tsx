import { useEffect, useMemo, useState } from "preact/hooks";
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

  // Advancing to the next step, with short-circuit handling for cases where
  // we shouldn't bother asking more questions.
  const advance = () => {
    if (currentStep) {
      send({ type: "stage_answered", stage: currentStep.stage, answer: snapshotForStep(currentStep.id, answers) });
    }

    const shouldShortCircuit =
      answers.gestationalAge === "under-9" ||
      answers.motivation === "high-risk-nhs" ||
      (answers.historyFlags ?? []).includes("previous-affected-pregnancy");

    goToStep(shouldShortCircuit ? steps.length : clampedStep + 1);
  };

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
