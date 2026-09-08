import type { Severity } from './Severity';

/**
 * Where a finding came from.
 *
 * Kept on the finding itself so the learner can always tell an automated
 * structural observation ("your design skeleton has no methods") apart from a
 * semantic judgement about their design.
 */
export const FindingSource = {
  STRUCTURAL: 'STRUCTURAL',
  LLM: 'LLM',
} as const;

export type FindingSource = (typeof FindingSource)[keyof typeof FindingSource];

/**
 * A single observation produced by an IEvaluator.
 *
 * This is the common currency between evaluation strategies. The
 * StructuralEvaluator emits these deterministically; they are then handed to
 * the semantic evaluator as context rather than used to gate it (PRD 4.1), so
 * a thin submission produces a grounded low score instead of a canned refusal.
 */
export class EvaluationFinding {
  /** Stable machine-readable identifier, e.g. EMPTY_DESIGN_SKELETON. */
  readonly code: string;
  readonly source: FindingSource;
  readonly severity: Severity;
  /** One line, written for the learner. */
  readonly message: string;
  /** Optional supporting context, e.g. the measurement behind the finding. */
  readonly detail: string | null;

  constructor(params: {
    code: string;
    source: FindingSource;
    severity: Severity;
    message: string;
    detail?: string | null;
  }) {
    this.code = params.code;
    this.source = params.source;
    this.severity = params.severity;
    this.message = params.message;
    this.detail = params.detail ?? null;
  }
}
