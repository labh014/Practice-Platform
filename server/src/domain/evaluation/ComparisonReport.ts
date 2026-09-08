import type { AttemptId, DimensionId } from '../shared/ids';
import type { DimensionDelta } from './DimensionDelta';
import type { FeedbackCategory } from './FeedbackCategory';

/**
 * What changed between the learner's previous attempt and this one.
 *
 * This report is the reason the product exists. Anyone can score a design once;
 * the thing that actually teaches is being shown that the coupling problem you
 * were told about last time is gone, and that the two you did not address are
 * still there.
 *
 * Every field here is computed deterministically from stored results
 * (assumption A3). None of it is generated. If the platform is going to tell a
 * learner they improved, that claim has to be arithmetic, not narration.
 */
export class ComparisonReport {
  readonly previousAttemptId: AttemptId;
  readonly previousAttemptNumber: number;
  readonly previousOverallScore: number;
  readonly currentOverallScore: number;
  readonly dimensionDeltas: readonly DimensionDelta[];

  /** Dimensions that had a CRITICAL or MAJOR issue before and have none now. */
  readonly resolvedDimensionIds: readonly DimensionId[];
  /** Dimensions still carrying a CRITICAL or MAJOR issue. */
  readonly persistingDimensionIds: readonly DimensionId[];
  /** Dimensions that were clean before and have picked up an issue. */
  readonly regressedDimensionIds: readonly DimensionId[];

  /** Issue categories closed since the previous attempt. */
  readonly resolvedCategories: readonly FeedbackCategory[];
  /** Issue categories still open. */
  readonly persistingCategories: readonly FeedbackCategory[];

  constructor(params: {
    previousAttemptId: AttemptId;
    previousAttemptNumber: number;
    previousOverallScore: number;
    currentOverallScore: number;
    dimensionDeltas: DimensionDelta[];
    resolvedDimensionIds: DimensionId[];
    persistingDimensionIds: DimensionId[];
    regressedDimensionIds: DimensionId[];
    resolvedCategories: FeedbackCategory[];
    persistingCategories: FeedbackCategory[];
  }) {
    this.previousAttemptId = params.previousAttemptId;
    this.previousAttemptNumber = params.previousAttemptNumber;
    this.previousOverallScore = params.previousOverallScore;
    this.currentOverallScore = params.currentOverallScore;
    this.dimensionDeltas = Object.freeze([...params.dimensionDeltas]);
    this.resolvedDimensionIds = Object.freeze([...params.resolvedDimensionIds]);
    this.persistingDimensionIds = Object.freeze([...params.persistingDimensionIds]);
    this.regressedDimensionIds = Object.freeze([...params.regressedDimensionIds]);
    this.resolvedCategories = Object.freeze([...params.resolvedCategories]);
    this.persistingCategories = Object.freeze([...params.persistingCategories]);
  }

  get overallDelta(): number {
    return this.currentOverallScore - this.previousOverallScore;
  }

  get hasImproved(): boolean {
    return this.overallDelta > 0;
  }

  /** Dimensions the learner moved forward on, ignoring those whose scope changed. */
  get improvedDeltas(): DimensionDelta[] {
    return this.dimensionDeltas.filter((delta) => delta.delta > 0);
  }

  /**
   * Genuine regressions only.
   *
   * A dimension whose scope changed under an active change scenario is excluded:
   * it is being asked a harder question than last time, so a lower number there
   * is not evidence that the design got worse.
   */
  get regressedDeltas(): DimensionDelta[] {
    return this.dimensionDeltas.filter((delta) => delta.delta < 0 && !delta.scopeChanged);
  }
}
