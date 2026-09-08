import { InvalidRubricError } from '../shared/DomainError';
import { MAX_DIMENSION_SCORE, MIN_DIMENSION_SCORE } from '../shared/scoring';

/**
 * A described range on a dimension's 0-5 scale.
 *
 * Bands are the platform's main defence against sycophantic evaluation. An LLM
 * asked to "rate cohesion out of 5" drifts upward, because praise is its
 * default register. An LLM asked "which of these three described bands does
 * this submission match" has to justify a 4 against a written standard, and a
 * 2 becomes a defined outcome rather than a reluctant one.
 *
 * They are also what makes a score explainable to the learner: the band text
 * is shown alongside the number, so the score is never a bare verdict.
 */
export class ScoreBand {
  readonly minScore: number;
  readonly maxScore: number;
  readonly descriptor: string;

  constructor(params: { minScore: number; maxScore: number; descriptor: string }) {
    const { minScore, maxScore, descriptor } = params;

    if (!Number.isInteger(minScore) || !Number.isInteger(maxScore)) {
      throw new InvalidRubricError('Score band bounds must be integers');
    }
    if (minScore < MIN_DIMENSION_SCORE || maxScore > MAX_DIMENSION_SCORE) {
      throw new InvalidRubricError(
        `Score band ${minScore}-${maxScore} falls outside ${MIN_DIMENSION_SCORE}-${MAX_DIMENSION_SCORE}`,
      );
    }
    if (minScore > maxScore) {
      throw new InvalidRubricError(`Score band has inverted bounds: ${minScore}-${maxScore}`);
    }
    if (!descriptor.trim()) {
      throw new InvalidRubricError(`Score band ${minScore}-${maxScore} must have a descriptor`);
    }

    this.minScore = minScore;
    this.maxScore = maxScore;
    this.descriptor = descriptor.trim();
  }

  contains(score: number): boolean {
    return score >= this.minScore && score <= this.maxScore;
  }

  get label(): string {
    return this.minScore === this.maxScore
      ? `${this.minScore}`
      : `${this.minScore}-${this.maxScore}`;
  }
}
