import type { ComponentChildren } from "preact";
import { useEffect, useRef } from "preact/hooks";
import type { Answers, FamilyCondition, HistoryFlag } from "../types";
import type { ConditionsStep, HistoryStep, SingleChoiceStep, Step } from "../config/flow";
import { Callout, MultiOptionCard, Nav, OptionCard, QuestionGroup } from "./Primitives";

// Delay after a single-choice click before auto-advancing. Long enough to
// register the selection visually, short enough to feel snappy.
const AUTO_ADVANCE_MS = 280;

interface Props {
  step: Step;
  answers: Answers;
  onChange: (patch: Partial<Answers>) => void;
  onAdvance: () => void;
  onBack?: () => void;
  phase: "entering" | "idle" | "leaving";
}

export function QuestionStep(props: Props) {
  switch (props.step.kind) {
    case "single":
      return <SingleStep {...props} step={props.step} />;
    case "history":
      return <HistoryStepView {...props} step={props.step} />;
    case "conditions":
      return <ConditionsStepView {...props} step={props.step} />;
  }
}

function StepShell(props: {
  step: Step;
  phase: Props["phase"];
  children: ComponentChildren;
  footer?: ComponentChildren;
}) {
  const { step, phase } = props;
  return (
    <div className={`nipt-step is-${phase}`}>
      <div className="nipt-step__label">Step {step.stage} of 4</div>
      <h2 className="nipt-step__title">{step.title}</h2>
      {step.subtitle && <p className="nipt-step__subtitle">{step.subtitle}</p>}
      {"hint" in step && step.hint && <p className="nipt-step__hint">{step.hint}</p>}
      <div className="nipt-step__body">{props.children}</div>
      {props.footer && <div className="nipt-step__footer">{props.footer}</div>}
    </div>
  );
}

function SingleStep(props: Props & { step: SingleChoiceStep }) {
  const { step, answers, onChange, onAdvance, onBack, phase } = props;
  const timerRef = useRef<number | null>(null);

  // Cancel any pending auto-advance when the step unmounts (e.g. user clicks
  // Back while the timer is waiting).
  useEffect(
    () => () => {
      if (timerRef.current != null) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    },
    [],
  );

  const current = answers[step.field];

  function handleSelect(value: string) {
    onChange({ [step.field]: value } as Partial<Answers>);
    if (step.autoAdvance && phase !== "leaving") {
      if (timerRef.current != null) window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(() => {
        timerRef.current = null;
        onAdvance();
      }, AUTO_ADVANCE_MS);
    }
  }

  return (
    <StepShell step={step} phase={phase} footer={onBack ? <Nav onBack={onBack} /> : undefined}>
      <QuestionGroup>
        {step.options.map((opt) => (
          <OptionCard
            key={opt.value}
            value={opt.value}
            selected={current === opt.value}
            onSelect={handleSelect}
            title={opt.title}
            description={opt.description}
            tag={opt.tag}
          />
        ))}
      </QuestionGroup>
    </StepShell>
  );
}

const HISTORY_OPTIONS: Array<{ value: HistoryFlag; title: string; description?: string }> = [
  { value: "maternal-35-plus", title: "Maternal age 35 or older" },
  { value: "paternal-40-plus", title: "Paternal age 40 to 44" },
  { value: "paternal-45-plus", title: "Paternal age 45 or older", description: "New genetic mutations become more common with higher paternal age." },
  { value: "previous-affected-pregnancy", title: "A previous pregnancy was affected by a genetic condition", description: "We'll route you to a midwife — this needs a conversation." },
  { value: "known-family-condition", title: "Known family history of a specific condition" },
  { value: "both-partners-ashkenazi", title: "Both partners of Ashkenazi Jewish background" },
  { value: "both-partners-mediterranean", title: "Both partners of Mediterranean background" },
  { value: "both-partners-sub-saharan", title: "Both partners of Sub-Saharan African background" },
  { value: "both-partners-south-asian", title: "Both partners of South Asian background" },
  { value: "consanguineous", title: "You and your partner are related by blood" },
];

function HistoryStepView(props: Props & { step: HistoryStep }) {
  const { step, answers, onChange, onAdvance, onBack, phase } = props;
  const flags = answers.historyFlags ?? [];

  function toggleFlag(v: HistoryFlag) {
    let next: HistoryFlag[];
    if (v === "none") {
      next = flags.includes("none") ? [] : ["none"];
    } else {
      const base = flags.filter((x) => x !== "none");
      next = base.includes(v) ? base.filter((x) => x !== v) : [...base, v];
    }
    onChange({ historyFlags: next });
  }

  const hasAnySelection = flags.length > 0;

  return (
    <StepShell
      step={step}
      phase={phase}
      footer={<Nav onBack={onBack} onNext={onAdvance} nextDisabled={!hasAnySelection} />}
    >
      <QuestionGroup>
        {HISTORY_OPTIONS.map((o) => (
          <MultiOptionCard
            key={o.value}
            value={o.value}
            selected={flags.includes(o.value)}
            onToggle={toggleFlag}
            title={o.title}
            description={o.description}
          />
        ))}
        <MultiOptionCard<HistoryFlag>
          value="none"
          selected={flags.includes("none")}
          onToggle={toggleFlag}
          title="None of the above"
        />
      </QuestionGroup>

      {flags.includes("previous-affected-pregnancy") && (
        <Callout tone="warn">
          Because a previous pregnancy was affected by a genetic condition, the best next step is a midwife call rather than a self-service recommendation. We'll route you there on the next screen.
        </Callout>
      )}
    </StepShell>
  );
}

const FAMILY_CONDITIONS: Array<{ value: FamilyCondition; title: string }> = [
  { value: "digeorge", title: "DiGeorge syndrome (22q11.2)" },
  { value: "cystic-fibrosis", title: "Cystic fibrosis" },
  { value: "sma", title: "Spinal muscular atrophy (SMA)" },
  { value: "thalassaemia", title: "Thalassaemia" },
  { value: "sickle-cell", title: "Sickle cell disease" },
  { value: "achondroplasia", title: "Achondroplasia" },
  { value: "fragile-x", title: "Fragile X syndrome" },
  { value: "other", title: "Something else (please note below)" },
];

function ConditionsStepView(props: Props & { step: ConditionsStep }) {
  const { step, answers, onChange, onAdvance, onBack, phase } = props;
  const conds = answers.familyConditions ?? [];

  function toggleCondition(v: FamilyCondition) {
    const next = conds.includes(v) ? conds.filter((x) => x !== v) : [...conds, v];
    onChange({ familyConditions: next });
  }

  return (
    <StepShell
      step={step}
      phase={phase}
      footer={<Nav onBack={onBack} onNext={onAdvance} nextDisabled={conds.length === 0} />}
    >
      <QuestionGroup>
        {FAMILY_CONDITIONS.map((o) => (
          <MultiOptionCard
            key={o.value}
            value={o.value}
            selected={conds.includes(o.value)}
            onToggle={toggleCondition}
            title={o.title}
          />
        ))}
        <label className="nipt-freetext">
          <span className="nipt-freetext__label">Notes (optional)</span>
          <textarea
            className="nipt-freetext__input"
            rows={2}
            value={answers.familyConditionNotes ?? ""}
            onInput={(e) =>
              onChange({ familyConditionNotes: (e.currentTarget as HTMLTextAreaElement).value })
            }
            placeholder="E.g. 'my cousin has Fragile X'"
          />
        </label>
      </QuestionGroup>
    </StepShell>
  );
}
