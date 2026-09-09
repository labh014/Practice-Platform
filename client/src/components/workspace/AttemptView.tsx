import { formatDate, statusLabel } from '../../lib/format';
import type { Attempt } from '../../types/api';
import { EvaluationPanel } from '../feedback/EvaluationPanel';

interface AttemptViewProps {
  attempt: Attempt;
  timedOut: boolean;
  onRetry: () => void;
  onTryAgain: () => void;
  retrying: boolean;
}

/**
 * A submitted attempt: the learner's design, and whatever came back.
 *
 * The design stays pinned at the top whatever the state (PRD 6.1). Feedback the
 * learner cannot see their own code beside is feedback they have to reconstruct
 * from memory, which is most of the reason generic advice feels useless.
 */
export function AttemptView({
  attempt,
  timedOut,
  onRetry,
  onTryAgain,
  retrying,
}: AttemptViewProps) {
  const pending = attempt.status === 'SUBMITTED' || attempt.status === 'EVALUATING';

  return (
    <div className="attempt-view">
      <header className="attempt-view__head">
        <div>
          <h2 className="attempt-view__title">Attempt {attempt.attemptNumber}</h2>
          <p className="subtle attempt-view__meta">
            {statusLabel(attempt.status)} · {formatDate(attempt.createdAt)}
            {attempt.result ? (
              <>
                {' · '}
                {/* Which evaluator judged THIS attempt. Kept on the attempt
                    rather than only in the global banner, because history
                    outlives configuration: an attempt scored offline stays
                    offline-scored after a key is added, and its numbers should
                    not be read as though a model produced them. */}
                {attempt.result.evaluatorModel === 'mock' ? (
                  <span className="attempt-view__offline">Offline evaluator</span>
                ) : (
                  <>evaluated by {attempt.result.evaluatorModel}</>
                )}
              </>
            ) : null}
          </p>
        </div>

        {!pending ? (
          <button type="button" className="btn btn--primary" onClick={onTryAgain}>
            Try again
          </button>
        ) : null}
      </header>

      <SubmittedDesign attempt={attempt} />

      {pending ? <EvaluatingPanel timedOut={timedOut} onRefresh={onRetry} /> : null}

      {attempt.status === 'FAILED' ? (
        <FailurePanel attempt={attempt} onRetry={onRetry} retrying={retrying} />
      ) : null}

      {attempt.status === 'COMPLETED' && attempt.result ? (
        <EvaluationPanel
          result={attempt.result}
          structuralFindings={attempt.structuralFindings}
        />
      ) : null}
    </div>
  );
}

function SubmittedDesign({ attempt }: { attempt: Attempt }) {
  const { submission } = attempt;

  return (
    <section className="submitted">
      <Block label="Design skeleton" body={submission.designSkeleton} mono />
      <Block label="Design decisions" body={submission.designDecisions} />
      <Block label="Assumptions and edge cases" body={submission.assumptions} />
    </section>
  );
}

function Block({ label, body, mono = false }: { label: string; body: string; mono?: boolean }) {
  return (
    <div className="submitted__block">
      <h3 className="submitted__label">{label}</h3>
      {body.trim().length > 0 ? (
        <pre className={`submitted__body${mono ? ' submitted__body--mono' : ''}`}>{body}</pre>
      ) : (
        <p className="subtle submitted__empty">Left empty</p>
      )}
    </div>
  );
}

/**
 * The waiting state.
 *
 * It says what is happening rather than showing a bare spinner, and it says the
 * submission is already saved - which is the thing a learner watching a
 * progress indicator actually wants to know.
 */
function EvaluatingPanel({ timedOut, onRefresh }: { timedOut: boolean; onRefresh: () => void }) {
  if (timedOut) {
    return (
      <section className="panel panel--warn">
        <h3 className="panel__title">This is taking longer than expected</h3>
        <p className="muted">
          Your submission is saved and nothing is lost. Check back, or refresh to look again.
        </p>
        <button type="button" className="btn btn--secondary" onClick={onRefresh}>
          Check again
        </button>
      </section>
    );
  }

  return (
    <section className="panel panel--busy" role="status" aria-live="polite">
      <div className="spinner" aria-hidden />
      <div>
        <h3 className="panel__title">Reviewing your design</h3>
        <p className="muted">
          Your submission is saved. Feedback will appear here — you can leave and come back.
        </p>
      </div>
    </section>
  );
}

/**
 * A failed evaluation.
 *
 * The submission is intact and says so, because the learner's first fear is
 * that they have lost fifteen minutes of work. Retry re-runs the stored
 * submission; nothing is retyped.
 */
function FailurePanel({
  attempt,
  onRetry,
  retrying,
}: {
  attempt: Attempt;
  onRetry: () => void;
  retrying: boolean;
}) {
  return (
    <section className="panel panel--error" role="alert">
      <h3 className="panel__title">Evaluation did not complete</h3>
      <p className="muted">
        Your design above is saved exactly as you submitted it. This was a problem with the
        evaluation, not with your work.
      </p>
      {attempt.failureReason ? (
        <p className="subtle panel__detail mono">{attempt.failureReason}</p>
      ) : null}

      {attempt.structuralFindings.length > 0 ? (
        <div className="panel__findings">
          <h4 className="panel__subtitle">What we could still check automatically</h4>
          <ul className="findings">
            {attempt.structuralFindings.map((finding) => (
              <li key={finding.code} className="findings__item">
                <span className="findings__message">{finding.message}</span>
                {finding.detail ? <span className="subtle"> {finding.detail}</span> : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <button
        type="button"
        className="btn btn--primary"
        onClick={onRetry}
        disabled={retrying}
      >
        {retrying ? 'Re-evaluating…' : 'Evaluate again'}
      </button>
    </section>
  );
}
