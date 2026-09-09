import { InvalidScoreError } from '../shared/DomainError';
import type { DimensionId } from '../shared/ids';
import { MAX_DIMENSION_SCORE, MIN_DIMENSION_SCORE } from '../shared/scoring';

/**
 * The learner's score on one rubric dimension, with the reasoning behind it.
 *
 * The justification is not decoration. A number on its own is a verdict; a
 * number with a stated reason is something the learner can argue with, learn
 * from, or act on - which is the difference between this product and a grader.
 *
 * A score of `null` means the evaluator declined to judge this dimension. That
 * is a first-class outcome, not a missing value: the platform already deletes
 * feedback it cannot ground in the submission, and a number the evaluator
 * cannot justify deserves exactly the same treatment. A wrong score is worse
 * than no score, because the learner cannot tell it apart from a real one and
 * it goes on to contaminate every improvement comparison built on top of it.
 *
 * The justification stays required either way - an abstention has to say why.
 */
export class DimensionScore {
  readonly dimensionId: DimensionId;
  /** Integer in [0, 5], or null when the evaluator declined to judge. */
  readonly score: number | null;
  /** Why this score, or why no score could be given. */
  readonly justification: string;

  constructor(params: {
    dimensionId: DimensionId;
    score: number | null;
    justification: string;
  }) {
    const { dimensionId, score, justification } = params;

    if (!dimensionId.trim()) {
      throw new InvalidScoreError('DimensionScore requires a dimension id');
    }

    if (score !== null) {
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

  get isAssessed(): boolean {
    return this.score !== null;
  }

  /** Fraction of the maximum, used when applying rubric weights. Null when unassessed. */
  get ratio(): number | null {
    return this.score === null ? null : this.score / MAX_DIMENSION_SCORE;
  }
}
