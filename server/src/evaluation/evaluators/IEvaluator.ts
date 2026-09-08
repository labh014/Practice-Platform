import type { EvaluationContext } from './EvaluationContext';
import type { EvaluationOutput } from './EvaluationOutput';

/**
 * How this evaluator reaches its conclusions.
 *
 * Surfaced so the orchestrator can order the pipeline (deterministic passes
 * first, since their findings become context for the semantic ones) without
 * hard-coding the names of the evaluators it happens to be running today.
 */
export const EvaluatorKind = {
  /** Same input, same output, no network. */
  DETERMINISTIC: 'DETERMINISTIC',
  /** Judgement-based; may call out to a model and may fail. */
  SEMANTIC: 'SEMANTIC',
} as const;

export type EvaluatorKind = (typeof EvaluatorKind)[keyof typeof EvaluatorKind];

/**
 * The Strategy contract for evaluating a submission (PRD 4).
 *
 * This is the seam the product is built around: a Problem states its standard,
 * an Attempt captures the work, and an IEvaluator applies one to the other.
 * Nothing about how a submission is judged lives in the Problem, so adding a
 * UML evaluator or a static-analysis pass later means writing one class and
 * registering it - no change to the domain, the repositories or the API.
 *
 * It is deliberately one small interface rather than a pipeline framework. The
 * abstraction earns its place because a second implementation already exists;
 * anything more would be architecture for its own sake.
 */
export interface IEvaluator {
  /** Recorded on the result so a score can be traced to what produced it. */
  readonly name: string;
  readonly kind: EvaluatorKind;

  evaluate(context: EvaluationContext): Promise<EvaluationOutput>;
}
