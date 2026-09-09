import { InvalidScoreError } from '../shared/DomainError';
import type { DimensionId } from '../shared/ids';
import { MAX_OVERALL_SCORE, MIN_OVERALL_SCORE } from '../shared/scoring';
import type { ComparisonReport } from './ComparisonReport';
import type { DimensionScore } from './DimensionScore';
import type { FeedbackItem } from './FeedbackItem';
import { compareSeverity, isBlockingSeverity, Severity } from './Severity';
import type { FeedbackCategory } from './FeedbackCategory';
import type { TradeOff } from './TradeOff';

/**
 * The complete, learner-facing outcome of evaluating one attempt.
 *
 * Two of these fields are deliberately not the evaluator's to decide.
 *
 * `overallScore` is computed by WeightedScoreCalculator from the dimension
 * scores and the rubric weights (assumption A2). Letting a model return its own
 * headline number invites it to contradict its own dimension scores - a 3, 3, 2,
 * 2 that somehow totals 78 - and the learner has no way to tell which number to
 * believe.
 *
 * `comparison` is computed by ComparisonReportBuilder from stored history
 * (assumption A3), for the same reason.
 */
export class EvaluationResult {
  /**
   * 0-100, derived and never generated - or null when the evaluator declined to
   * judge one or more dimensions.
   *
   * A partial total would be arithmetic on a number nobody stood behind. Saying
   * "not scored" is the honest output, and it is what stops an unjustified score
   * flowing into the improvement delta and corrupting the one claim this product
   * exists to make.
   */
  readonly overallScore: number | null;
  readonly dimensionScores: readonly DimensionScore[];
  /** What the learner genuinely did well. Specific, not consolation. */
  readonly strengths: readonly string[];
  readonly feedback: readonly FeedbackItem[];
  readonly tradeOffs: readonly TradeOff[];
  /** Null on a first attempt, or when no earlier attempt completed. */
  readonly comparison: ComparisonReport | null;
  /** e.g. "mock", "gemini-2.0-flash". Recorded so a score can be traced to its evaluator. */
  readonly evaluatorModel: string;
  readonly evaluatedAt: Date;

  private readonly scoresByDimension: ReadonlyMap<DimensionId, DimensionScore>;

  constructor(params: {
    overallScore: number | null;
    dimensionScores: DimensionScore[];
    strengths: string[];
    feedback: FeedbackItem[];
    tradeOffs: TradeOff[];
    comparison?: ComparisonReport | null;
    evaluatorModel: string;
    evaluatedAt?: Date;
  }) {
    const { overallScore } = params;

    if (overallScore !== null) {
      if (!Number.isFinite(overallScore)) {
        throw new InvalidScoreError(`Overall score must be a finite number, got ${overallScore}`);
      }
      if (overallScore < MIN_OVERALL_SCORE || overallScore > MAX_OVERALL_SCORE) {
        throw new InvalidScoreError(
          `Overall score ${overallScore} is outside ${MIN_OVERALL_SCORE}-${MAX_OVERALL_SCORE}`,
        );
      }
    }
    if (params.dimensionScores.length === 0) {
      throw new InvalidScoreError('An evaluation result must score at least one dimension');
    }

    const scoresByDimension = new Map<DimensionId, DimensionScore>();
    for (const dimensionScore of params.dimensionScores) {
      if (scoresByDimension.has(dimensionScore.dimensionId)) {
        throw new InvalidScoreError(
          `Dimension ${dimensionScore.dimensionId} scored more than once`,
        );
      }
      scoresByDimension.set(dimensionScore.dimensionId, dimensionScore);
    }

    this.overallScore = overallScore;
    this.dimensionScores = Object.freeze([...params.dimensionScores]);
    this.strengths = Object.freeze([...params.strengths]);
    this.feedback = Object.freeze(
      [...params.feedback].sort((a, b) => compareSeverity(a.severity, b.severity)),
    );
    this.tradeOffs = Object.freeze([...params.tradeOffs]);
    this.comparison = params.comparison ?? null;
    this.evaluatorModel = params.evaluatorModel;
    this.evaluatedAt = params.evaluatedAt ?? new Date();
    this.scoresByDimension = scoresByDimension;
  }

  /** True when the evaluator declined to produce an overall judgement. */
  get isAssessed(): boolean {
    return this.overallScore !== null;
  }

  /** Dimensions the evaluator declined to judge. */
  get unassessedDimensionIds(): DimensionId[] {
    return this.dimensionScores.filter((s) => !s.isAssessed).map((s) => s.dimensionId);
  }

  scoreFor(dimensionId: DimensionId): DimensionScore | undefined {
    return this.scoresByDimension.get(dimensionId);
  }

  feedbackFor(dimensionId: DimensionId): FeedbackItem[] {
    return this.feedback.filter((item) => item.dimensionId === dimensionId);
  }

  get criticalFeedback(): FeedbackItem[] {
    return this.feedback.filter((item) => item.severity === Severity.CRITICAL);
  }

  /**
   * Dimensions carrying at least one CRITICAL or MAJOR issue.
   *
   * Used by ComparisonReportBuilder to decide what counts as resolved next time.
   */
  get dimensionsWithOpenIssues(): DimensionId[] {
    const ids = new Set<DimensionId>();
    for (const item of this.feedback) {
      if (isBlockingSeverity(item.severity)) ids.add(item.dimensionId);
    }
    return [...ids];
  }

  /** Distinct categories of open (CRITICAL or MAJOR) issues. */
  get openIssueCategories(): FeedbackCategory[] {
    const categories = new Set<FeedbackCategory>();
    for (const item of this.feedback) {
      if (isBlockingSeverity(item.severity)) categories.add(item.category);
    }
    return [...categories];
  }

  /** Returns a copy carrying the comparison report, which is built after scoring. */
  withComparison(comparison: ComparisonReport | null): EvaluationResult {
    return new EvaluationResult({
      overallScore: this.overallScore,
      dimensionScores: [...this.dimensionScores],
      strengths: [...this.strengths],
      feedback: [...this.feedback],
      tradeOffs: [...this.tradeOffs],
      comparison,
      evaluatorModel: this.evaluatorModel,
      evaluatedAt: this.evaluatedAt,
    });
  }
}
