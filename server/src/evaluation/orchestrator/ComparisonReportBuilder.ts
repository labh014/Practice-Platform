import {
  ComparisonReport,
  type DimensionId,
  DimensionDelta,
  type DimensionScore,
  type EvaluationResult,
  type EvaluationRubric,
  type FeedbackCategory,
  type FeedbackItem,
  isBlockingSeverity,
} from '../../domain';
import type { AttemptId } from '../../domain';

export interface PreviousAttemptSnapshot {
  readonly attemptId: AttemptId;
  readonly attemptNumber: number;
  readonly result: EvaluationResult;
  /** Whether a change scenario was in force when that attempt was evaluated. */
  readonly changeScenarioDimensionId: DimensionId | null;
}

/**
 * Computes what changed between two attempts.
 *
 * Every number here is arithmetic over stored results (assumption A3). Nothing
 * is generated, because the single claim this product cannot afford to get
 * wrong is whether the learner actually improved. A model asked to narrate its
 * own progress report will find progress; subtraction will not.
 *
 * Issue resolution is decided by dimension and category rather than by matching
 * prose, which is why FeedbackCategory is a closed set. It lets the platform say
 * "the coupling problem from attempt 1 is gone" from data, instead of guessing
 * from two differently worded paragraphs.
 */
export class ComparisonReportBuilder {
  build(params: {
    previous: PreviousAttemptSnapshot;
    currentDimensionScores: readonly DimensionScore[];
    /** Non-null; the orchestrator skips the comparison entirely when unscored. */
    currentOverallScore: number;
    currentFeedback: readonly FeedbackItem[];
    rubric: EvaluationRubric;
    /** The dimension a change scenario probes for the current attempt, if any. */
    currentChangeScenarioDimensionId: DimensionId | null;
  }): ComparisonReport {
    const {
      previous,
      currentDimensionScores,
      currentOverallScore,
      currentFeedback,
      rubric,
      currentChangeScenarioDimensionId,
    } = params;

    const currentById = new Map(currentDimensionScores.map((s) => [s.dimensionId, s]));

    const dimensionDeltas: DimensionDelta[] = [];

    for (const dimension of rubric.dimensions) {
      const previousScore = previous.result.scoreFor(dimension.id);
      const currentScore = currentById.get(dimension.id);

      // A dimension missing from either side cannot be compared. Skipping is
      // better than inventing a zero, which would read as a total collapse.
      // The same applies when either evaluator declined to judge it: there is
      // no movement to report between a number and an abstention.
      if (!previousScore || !currentScore) continue;
      if (previousScore.score === null || currentScore.score === null) continue;

      dimensionDeltas.push(
        new DimensionDelta({
          dimensionId: dimension.id,
          dimensionName: dimension.name,
          previousScore: previousScore.score,
          currentScore: currentScore.score,
          scopeChanged: this.didScopeChange(
            dimension.id,
            previous.changeScenarioDimensionId,
            currentChangeScenarioDimensionId,
          ),
        }),
      );
    }

    const previousOpen = new Set(previous.result.dimensionsWithOpenIssues);
    const currentOpen = new Set(openDimensions(currentFeedback));

    const previousCategories = new Set(previous.result.openIssueCategories);
    const currentCategories = new Set(openCategories(currentFeedback));

    return new ComparisonReport({
      previousAttemptId: previous.attemptId,
      previousAttemptNumber: previous.attemptNumber,
      // Non-null by the orchestrator's guard: it does not build a comparison
      // unless both attempts produced a real total.
      previousOverallScore: previous.result.overallScore ?? 0,
      currentOverallScore,
      dimensionDeltas,
      resolvedDimensionIds: [...previousOpen].filter((id) => !currentOpen.has(id)),
      persistingDimensionIds: [...previousOpen].filter((id) => currentOpen.has(id)),
      regressedDimensionIds: [...currentOpen].filter((id) => !previousOpen.has(id)),
      resolvedCategories: [...previousCategories].filter((c) => !currentCategories.has(c)),
      persistingCategories: [...previousCategories].filter((c) => currentCategories.has(c)),
    });
  }

  /**
   * Whether this dimension is being asked a harder question than last time.
   *
   * Assumption A1 in effect. Once the change scenario unlocks, Extensibility is
   * judged against "would this absorb EV charging?" rather than the open
   * question it faced on attempt 1. A flat or lower score there is therefore
   * not evidence the design got worse, and the flag lets the UI say so instead
   * of showing a red arrow the learner cannot account for.
   */
  private didScopeChange(
    dimensionId: DimensionId,
    previousScenarioDimensionId: DimensionId | null,
    currentScenarioDimensionId: DimensionId | null,
  ): boolean {
    return (
      currentScenarioDimensionId === dimensionId &&
      previousScenarioDimensionId !== dimensionId
    );
  }
}

function openDimensions(feedback: readonly FeedbackItem[]): DimensionId[] {
  return [
    ...new Set(
      feedback.filter((item) => isBlockingSeverity(item.severity)).map((item) => item.dimensionId),
    ),
  ];
}

function openCategories(feedback: readonly FeedbackItem[]): FeedbackCategory[] {
  return [
    ...new Set(
      feedback.filter((item) => isBlockingSeverity(item.severity)).map((item) => item.category),
    ),
  ];
}
