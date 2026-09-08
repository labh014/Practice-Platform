import type {
  DimensionScore,
  EvaluationFinding,
  FeedbackItem,
  TradeOff,
} from '../../domain';

/**
 * What a single evaluator contributes to an evaluation.
 *
 * PRD 4.1 specifies `IEvaluator` as returning `EvaluationFinding[]`. That
 * carries the structural evaluator's output fine, but not the semantic one's -
 * dimension scores, strengths, feedback items and trade-offs have nowhere to go.
 * Rather than give the two evaluators different signatures and lose the Strategy
 * pattern, the return type is widened to this object.
 *
 * Every field is an array, empty when an evaluator has no opinion on it. The
 * structural pass genuinely has no view on cohesion, so it returns findings and
 * four empty arrays - which is honest, not a hole. The orchestrator then merges
 * outputs from N evaluators uniformly, with no per-evaluator branching, so a
 * third strategy costs one registration and nothing else.
 *
 * Note that there is still no `overallScore` here. No evaluator authors it.
 */
export class EvaluationOutput {
  readonly findings: readonly EvaluationFinding[];
  readonly dimensionScores: readonly DimensionScore[];
  readonly strengths: readonly string[];
  readonly feedback: readonly FeedbackItem[];
  readonly tradeOffs: readonly TradeOff[];

  constructor(params: {
    findings?: readonly EvaluationFinding[];
    dimensionScores?: readonly DimensionScore[];
    strengths?: readonly string[];
    feedback?: readonly FeedbackItem[];
    tradeOffs?: readonly TradeOff[];
  }) {
    this.findings = Object.freeze([...(params.findings ?? [])]);
    this.dimensionScores = Object.freeze([...(params.dimensionScores ?? [])]);
    this.strengths = Object.freeze([...(params.strengths ?? [])]);
    this.feedback = Object.freeze([...(params.feedback ?? [])]);
    this.tradeOffs = Object.freeze([...(params.tradeOffs ?? [])]);
  }

  /** An output carrying deterministic signals only. */
  static ofFindings(findings: readonly EvaluationFinding[]): EvaluationOutput {
    return new EvaluationOutput({ findings });
  }

  static empty(): EvaluationOutput {
    return new EvaluationOutput({});
  }

  /** Combines outputs in order, for the orchestrator to assemble a result from. */
  static merge(outputs: readonly EvaluationOutput[]): EvaluationOutput {
    return new EvaluationOutput({
      findings: outputs.flatMap((output) => [...output.findings]),
      dimensionScores: outputs.flatMap((output) => [...output.dimensionScores]),
      strengths: outputs.flatMap((output) => [...output.strengths]),
      feedback: outputs.flatMap((output) => [...output.feedback]),
      tradeOffs: outputs.flatMap((output) => [...output.tradeOffs]),
    });
  }
}
