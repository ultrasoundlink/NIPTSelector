import type { ComponentChildren, JSX } from "preact";

interface OptionCardProps<T> {
  value: T;
  selected: boolean;
  onSelect: (v: T) => void;
  title: string;
  description?: string;
  tag?: string;
}

export function OptionCard<T extends string>({
  value,
  selected,
  onSelect,
  title,
  description,
  tag,
}: OptionCardProps<T>) {
  return (
    <button
      type="button"
      className={`nipt-option${selected ? " is-selected" : ""}`}
      onClick={() => onSelect(value)}
      aria-pressed={selected}
    >
      <span className="nipt-option__radio" aria-hidden="true" />
      <span className="nipt-option__body">
        <span className="nipt-option__title">{title}</span>
        {description && <span className="nipt-option__desc">{description}</span>}
      </span>
      {tag && <span className="nipt-option__tag">{tag}</span>}
    </button>
  );
}

interface MultiOptionCardProps<T> {
  value: T;
  selected: boolean;
  onToggle: (v: T) => void;
  title: string;
  description?: string;
}

export function MultiOptionCard<T extends string>({
  value,
  selected,
  onToggle,
  title,
  description,
}: MultiOptionCardProps<T>) {
  return (
    <button
      type="button"
      className={`nipt-option nipt-option--multi${selected ? " is-selected" : ""}`}
      onClick={() => onToggle(value)}
      aria-pressed={selected}
    >
      <span className="nipt-option__check" aria-hidden="true">
        {selected ? "✓" : ""}
      </span>
      <span className="nipt-option__body">
        <span className="nipt-option__title">{title}</span>
        {description && <span className="nipt-option__desc">{description}</span>}
      </span>
    </button>
  );
}

interface ProgressProps {
  stage: number;
  totalStages: number;
}

export function Progress({ stage, totalStages }: ProgressProps) {
  const pct = Math.round(((stage + 1) / (totalStages + 1)) * 100);
  return (
    <div className="nipt-progress" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
      <div className="nipt-progress__bar" style={{ width: `${pct}%` }} />
      <div className="nipt-progress__label">Step {Math.min(stage + 1, totalStages)} of {totalStages}</div>
    </div>
  );
}

interface NavProps {
  onBack?: () => void;
  onNext?: () => void;
  nextDisabled?: boolean;
  nextLabel?: string;
  backLabel?: string;
}

export function Nav({ onBack, onNext, nextDisabled, nextLabel = "Continue", backLabel = "Back" }: NavProps) {
  return (
    <div className="nipt-nav">
      {onBack ? (
        <button type="button" className="nipt-btn nipt-btn--ghost" onClick={onBack}>
          ← {backLabel}
        </button>
      ) : (
        <span />
      )}
      {onNext && (
        <button type="button" className="nipt-btn nipt-btn--primary" onClick={onNext} disabled={nextDisabled}>
          {nextLabel}
        </button>
      )}
    </div>
  );
}

export function QuestionGroup(props: { legend?: string; children: ComponentChildren; hint?: string }) {
  return (
    <fieldset className="nipt-group">
      {props.legend ? <legend className="nipt-group__legend">{props.legend}</legend> : null}
      {props.hint && <p className="nipt-group__hint">{props.hint}</p>}
      <div className="nipt-group__options">{props.children}</div>
    </fieldset>
  );
}

export function Callout({ tone = "info", children }: { tone?: "info" | "warn" | "success"; children: ComponentChildren }): JSX.Element {
  return <div className={`nipt-callout nipt-callout--${tone}`}>{children}</div>;
}
