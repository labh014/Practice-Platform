import { InvalidRubricError } from '../shared/DomainError';
import type { DimensionId } from '../shared/ids';
import { MAX_DIMENSION_SCORE, MIN_DIMENSION_SCORE } from '../shared/scoring';
import { ScoreBand } from './ScoreBand';

/**
 * One axis a design is judged on - Responsibility & Cohesion, Coupling &
 * Abstraction Quality, Requirement Completeness, Extensibility & Trade-offs.
 *
 * A dimension carries its own weight and its own written standard. Feedback
 * items reference a dimension by id, so every criticism the learner reads is
 * traceable to the number it cost them.
 */
export class EvaluationDimension {
  readonly id: DimensionId;
  readonly name: string;
  readonly description: string;
  /** Percentage of the overall score. Weights across a rubric must sum to 100. */
  readonly weight: number;
  readonly bands: readonly ScoreBand[];

  constructor(params: {
    id: DimensionId;
    name: string;
    description: string;
    weight: number;
    bands: ScoreBand[];
  }) {
    const { id, name, description, weight, bands } = params;

    if (!id.trim()) {
      throw new InvalidRubricError('Dimension id must not be empty');
    }
    if (!name.trim()) {
      throw new InvalidRubricError(`Dimension ${id} must have a name`);
    }
    if (!description.trim()) {
      throw new InvalidRubricError(`Dimension ${id} must have a description`);
    }
    if (!Number.isFinite(weight) || weight <= 0 || weight > 100) {
      throw new InvalidRubricError(
        `Dimension ${id} has weight ${weight}; expected a percentage in (0, 100]`,
      );
    }
    if (bands.length === 0) {
      throw new InvalidRubricError(
        `Dimension ${id} must define at least one score band. Bands are what keep ` +
          `scoring explainable and resistant to grade inflation.`,
      );
    }

    this.id = id;
    this.name = name.trim();
    this.description = description.trim();
    this.weight = weight;
    this.bands = [...bands].sort((a, b) => a.minScore - b.minScore);

    this.assertBandsCoverScale();
  }

  /**
   * Every score from 0 to 5 must land in exactly one band.
   *
   * Without this, a seed author can leave a hole in the scale and the evaluator
   * returns a score the platform cannot describe back to the learner.
   */
  private assertBandsCoverScale(): void {
    let expectedNext = MIN_DIMENSION_SCORE;

    for (const band of this.bands) {
      if (band.minScore !== expectedNext) {
        throw new InvalidRubricError(
          `Dimension ${this.id} has a gap or overlap in its score bands near ${expectedNext}`,
        );
      }
      expectedNext = band.maxScore + 1;
    }

    if (expectedNext !== MAX_DIMENSION_SCORE + 1) {
      throw new InvalidRubricError(
        `Dimension ${this.id} bands stop at ${expectedNext - 1}; must cover through ${MAX_DIMENSION_SCORE}`,
      );
    }
  }

  /** The written standard a given score corresponds to, for display and for prompting. */
  bandFor(score: number): ScoreBand {
    const band = this.bands.find((candidate) => candidate.contains(score));
    if (!band) {
      throw new InvalidRubricError(`Dimension ${this.id} has no band covering score ${score}`);
    }
    return band;
  }
}
