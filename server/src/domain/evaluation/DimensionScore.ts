import { InvalidScoreError } from '../shared/DomainError';
import type { DimensionId } from '../shared/ids';
import { MAX_DIMENSION_SCORE, MIN_DIMENSION_SCORE } from '../shared/scoring';

/**
 * The learner's score on one rubric dimension, with the reasoning behind it.
 *
 * The justification is not decoration. A number on its own is a verdict; a
 * number with a stated reason is something the learner can argue with, learn
 * from, or act on - which is the difference between this product and a grader.
 */
export class DimensionScore {
  readonly dimensionId: DimensionId;
  /** Integer in [0, 5]. */
  readonly score: number;
  /** Why this score, grounded in the submission. */
  readonly justification: string;

  constructor(params: { dimensionId: DimensionId; score: number; justification: string }) {
    const { dimensionId, score, justification } = params;

    if (!dimensionId.trim()) {
      throw new InvalidScoreError('DimensionScore requires a dimension id');
    }
    if (!Number.isInteger(score)) {
      throw new InvalidScoreError(
        `Score for ${dimensionId} must be an integer, got ${score}. Fractional scores ` +
          `imply a precision this kind of judgement does not have.`,
      );
    }
    if (score < MIN_DIMENSION_SCORE || score > MAX_DIMENSION_SCORE) {
      throw new InvalidScoreError(
        `Score ${score} for ${dimensionId} is outside ${MIN_DIMENSION_SCORE}-${MAX_DIMENSION_SCORE}`,
      );
    }
    if (!justification.trim()) {
      throw new InvalidScoreError(
        `Score for ${dimensionId} must carry a justification; an unexplained score is ` +
          `exactly the black box this platform is meant to avoid`,
      );
    }

    this.dimensionId = dimensionId;
    this.score = score;
    this.justification = justification.trim();
  }

  /** Fraction of the maximum, used when applying rubric weights. */
  get ratio(): number {
    return this.score / MAX_DIMENSION_SCORE;
  }
}
