import type { EvaluationFinding } from '../evaluation/EvaluationFinding';
import type { EvaluationResult } from '../evaluation/EvaluationResult';
import { InvalidAttemptTransitionError } from '../shared/DomainError';
import type { AttemptId, ProblemId, UserId } from '../shared/ids';
import type { Submission } from '../submission/Submission';
import { AttemptStatus, canTransition } from './AttemptStatus';

/**
 * One practice session: a learner's submission against a problem, and whatever
 * came back.
 *
 * Attempt is the aggregate root of the practice loop and the only mutable
 * entity in the domain. It owns its own state machine rather than letting a
 * service set `status` directly, because the alternative - status as a public
 * field - is how an attempt ends up completed twice, or completed after it
 * already failed, and the learner's history quietly stops being true.
 *
 * The submission is captured once at construction and never replaced. Revising
 * a design creates attempt N+1; that is what turns history into a record of how
 * the learner's thinking changed rather than a single mutable draft.
 */
export class Attempt {
  readonly id: AttemptId;
  readonly problemId: ProblemId;
  readonly userId: UserId;
  /** 1-based position in this learner's attempts at this problem. */
  readonly attemptNumber: number;
  readonly submission: Submission;
  readonly createdAt: Date;

  private _status: AttemptStatus;
  private _result: EvaluationResult | null = null;
  private _failureReason: string | null = null;
  private _structuralFindings: readonly EvaluationFinding[] = [];
  private _evaluationStartedAt: Date | null = null;
  private _evaluationEndedAt: Date | null = null;
  private _evaluationRuns = 0;

  constructor(params: {
    id: AttemptId;
    problemId: ProblemId;
    userId: UserId;
    attemptNumber: number;
    submission: Submission;
    createdAt?: Date;
  }) {
    if (!Number.isInteger(params.attemptNumber) || params.attemptNumber < 1) {
      throw new InvalidAttemptTransitionError(
        `Attempt number must be a positive integer, got ${params.attemptNumber}`,
      );
    }

    this.id = params.id;
    this.problemId = params.problemId;
    this.userId = params.userId;
    this.attemptNumber = params.attemptNumber;
    this.submission = params.submission;
    this.createdAt = params.createdAt ?? new Date();
    this._status = AttemptStatus.SUBMITTED;
  }

  get status(): AttemptStatus {
    return this._status;
  }

  get result(): EvaluationResult | null {
    return this._result;
  }

  get failureReason(): string | null {
    return this._failureReason;
  }

  /**
   * Deterministic signals from the StructuralEvaluator.
   *
   * Held on the Attempt rather than only on the result so they survive a failed
   * evaluation (assumption A10). If the LLM step falls over, the learner still
   * gets the objective observations about their submission instead of a blank
   * screen.
   */
  get structuralFindings(): readonly EvaluationFinding[] {
    return this._structuralFindings;
  }

  get evaluationStartedAt(): Date | null {
    return this._evaluationStartedAt;
  }

  get evaluationEndedAt(): Date | null {
    return this._evaluationEndedAt;
  }

  /** How many times evaluation has been run, including retries. */
  get evaluationRuns(): number {
    return this._evaluationRuns;
  }

  get isPending(): boolean {
    return (
      this._status === AttemptStatus.SUBMITTED || this._status === AttemptStatus.EVALUATING
    );
  }

  get isRetryable(): boolean {
    return this._status === AttemptStatus.FAILED;
  }

  /** Moves into evaluation. Legal from SUBMITTED and, for retries, from FAILED. */
  beginEvaluation(): void {
    this.assertCanTransitionTo(AttemptStatus.EVALUATING);

    this._status = AttemptStatus.EVALUATING;
    this._evaluationStartedAt = new Date();
    this._evaluationEndedAt = null;
    this._failureReason = null;
    this._evaluationRuns += 1;
  }

  recordStructuralFindings(findings: EvaluationFinding[]): void {
    this._structuralFindings = Object.freeze([...findings]);
  }

  completeWith(result: EvaluationResult): void {
    this.assertCanTransitionTo(AttemptStatus.COMPLETED);

    this._status = AttemptStatus.COMPLETED;
    this._result = result;
    this._failureReason = null;
    this._evaluationEndedAt = new Date();
  }

  /**
   * Marks evaluation as failed while keeping the submission intact.
   *
   * The reason is stored so the UI can tell the learner what went wrong rather
   * than showing an unexplained error state.
   */
  failWith(reason: string): void {
    this.assertCanTransitionTo(AttemptStatus.FAILED);

    this._status = AttemptStatus.FAILED;
    this._failureReason = reason;
    this._evaluationEndedAt = new Date();
  }

  private assertCanTransitionTo(next: AttemptStatus): void {
    if (!canTransition(this._status, next)) {
      throw new InvalidAttemptTransitionError(
        `Attempt ${this.id} cannot move from ${this._status} to ${next}`,
      );
    }
  }
}
