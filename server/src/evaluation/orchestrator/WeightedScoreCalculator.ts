import {
  type DimensionScore,
  type EvaluationRubric,
  InvalidScoreError,
  MAX_OVERALL_SCORE,
} from '../../domain';

/**
 * Derives the overall score from dimension scores and rubric weights.
 *
 * The headline number is arithmetic, never something a model reports
 * (assumption A2). Left to author its own total, a model will eventually return
 * 78 alongside dimension scores of 2, 2, 3 and 3, and the learner is left
 * holding two numbers with no way to tell which one means anything.
 *
 * Computing it also makes the score defensible in the direction that matters:
 * a learner who disputes a 55 can be shown the four scores and the four
 * weights that produced it.
 */
export class WeightedScoreCalculator {
  /**
   * @returns an integer in [0, 100].
   * @throws InvalidScoreError if a rubric dimension was not scored.
   */
  calculate(dimensionScores: readonly DimensionScore[], rubric: EvaluationRubric): number {
    const byId = new Map(dimensionScores.map((score) => [score.dimensionId, score]));

    let total = 0;

    for (const dimension of rubric.dimensions) {
      const score = byId.get(dimension.id);

      if (!score) {
        throw new InvalidScoreError(
          `Cannot compute an overall score: dimension "${dimension.id}" was not scored. ` +
            `A partial rubric would produce a total that silently understates the design.`,
        );
      }

      total += score.ratio * dimension.weight;
    }

    return clampToRange(Math.round(total));
  }
}

function clampToRange(value: number): number {
  return Math.max(0, Math.min(MAX_OVERALL_SCORE, value));
}
