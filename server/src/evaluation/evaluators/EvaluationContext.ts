import type {
  ChangeScenario,
  EvaluationFinding,
  EvaluationResult,
  Problem,
  Submission,
} from '../../domain';

/**
 * Everything an evaluator needs to judge one attempt, and nothing more.
 *
 * The context is immutable. The orchestrator runs the deterministic pass first
 * and then derives a second context carrying those findings
 * (`withStructuralFindings`), rather than letting evaluators mutate shared
 * state as they go. With two evaluators that is a small nicety; the moment a
 * third arrives it is the difference between an ordered pipeline and a set of
 * hidden dependencies.
 */
export class EvaluationContext {
  readonly problem: Problem;
  readonly submission: Submission;
  readonly attemptNumber: number;
  /** The most recent COMPLETED result for this learner and problem, if any. */
  readonly previousResult: EvaluationResult | null;
  /** Deterministic signals, populated between the structural and semantic passes. */
  readonly structuralFindings: readonly EvaluationFinding[];

  constructor(params: {
    problem: Problem;
    submission: Submission;
    attemptNumber: number;
    previousResult?: EvaluationResult | null;
    structuralFindings?: readonly EvaluationFinding[];
  }) {
    this.problem = params.problem;
    this.submission = params.submission;
    this.attemptNumber = params.attemptNumber;
    this.previousResult = params.previousResult ?? null;
    this.structuralFindings = Object.freeze([...(params.structuralFindings ?? [])]);
  }

  /**
   * The change scenario in force for this attempt, or null.
   *
   * Delegates to Problem so the unlock rule has exactly one definition. The
   * prompt builder, the score calculator and the UI all read it from here, so
   * the learner can never be shown a scenario the evaluator did not consider.
   */
  get activeChangeScenario(): ChangeScenario | null {
    return this.problem.activeChangeScenarioFor(this.attemptNumber);
  }

  get isFirstAttempt(): boolean {
    return this.attemptNumber === 1;
  }

  withStructuralFindings(findings: readonly EvaluationFinding[]): EvaluationContext {
    return new EvaluationContext({
      problem: this.problem,
      submission: this.submission,
      attemptNumber: this.attemptNumber,
      previousResult: this.previousResult,
      structuralFindings: findings,
    });
  }
}
