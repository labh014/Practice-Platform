import type { Draft } from '../../hooks/useDraft';

interface SubmissionEditorProps {
  draft: Draft;
  attemptNumber: number;
  revisingFrom: number | null;
  submitting: boolean;
  error: string | null;
  onChange: (field: keyof Draft, value: string) => void;
  onSubmit: () => void;
  onDiscard: (() => void) | null;
}

/**
 * The three fields a submission is made of.
 *
 * The guidance under each heading is doing real teaching. Most learners arrive
 * expecting to be graded on the code, and will type a class list and stop - so
 * the decisions field says plainly that the reasoning is the part an
 * interviewer actually probes, and the assumptions field says that naming what
 * you excluded is scoping rather than an admission of gaps.
 *
 * Placeholders show shape rather than content. A worked example would get
 * copied; a skeleton of the form gets filled in.
 */
export function SubmissionEditor({
  draft,
  attemptNumber,
  revisingFrom,
  submitting,
  error,
  onChange,
  onSubmit,
  onDiscard,
}: SubmissionEditorProps) {
  const empty =
    draft.designSkeleton.trim().length === 0 &&
    draft.designDecisions.trim().length === 0 &&
    draft.assumptions.trim().length === 0;

  return (
    <div className="editor">
      <header className="editor__head">
        <div>
          <h2 className="editor__title">Attempt {attemptNumber}</h2>
          <p className="subtle editor__subtitle">
            {revisingFrom !== null
              ? `Revising your attempt ${revisingFrom} design. Change what the feedback called out.`
              : 'Method bodies can be empty. What is assessed is where you draw the boundaries.'}
          </p>
        </div>

        {onDiscard ? (
          <button type="button" className="btn btn--ghost" onClick={onDiscard}>
            Cancel
          </button>
        ) : null}
      </header>

      <Field
        label="Design skeleton"
        hint="Classes, interfaces, methods and how they relate."
        value={draft.designSkeleton}
        onChange={(value) => onChange('designSkeleton', value)}
        placeholder={`interface FeeStrategy {\n  Money feeFor(Ticket ticket);\n}\n\nclass SpotAllocator {\n  Spot allocate(Vehicle vehicle);\n}`}
        rows={16}
        mono
      />

      <Field
        label="Design decisions"
        hint="Why these abstractions? This is the half an interviewer actually probes."
        value={draft.designDecisions}
        onChange={(value) => onChange('designDecisions', value)}
        placeholder="For each boundary you drew, answer: what would have to change in the world for this to be the wrong split?"
        rows={6}
      />

      <Field
        label="Assumptions and edge cases"
        hint="What you deliberately left out. Naming it is scoping, not a gap."
        value={draft.assumptions}
        onChange={(value) => onChange('assumptions', value)}
        placeholder="Assumed a single lot. Payment capture is out of scope. Have not handled a full lot."
        rows={5}
      />

      {error ? <p className="editor__error">{error}</p> : null}

      <div className="editor__actions">
        <button
          type="button"
          className="btn btn--primary"
          onClick={onSubmit}
          disabled={submitting}
        >
          {submitting ? 'Submitting…' : 'Submit for review'}
        </button>

        {empty ? (
          <span className="subtle editor__hint">
            You can submit an empty design — you will get a scored explanation of why.
          </span>
        ) : null}
      </div>
    </div>
  );
}

function Field({
  label,
  hint,
  value,
  onChange,
  placeholder,
  rows,
  mono = false,
}: {
  label: string;
  hint: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  rows: number;
  mono?: boolean;
}) {
  return (
    <div className="field">
      <label className="field__label">
        <span className="field__name">{label}</span>
        <span className="subtle field__count">{value.length}</span>
      </label>
      <p className="subtle field__hint">{hint}</p>
      <textarea
        className={`field__input${mono ? ' field__input--mono' : ''}`}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        rows={rows}
        spellCheck={!mono}
      />
    </div>
  );
}
