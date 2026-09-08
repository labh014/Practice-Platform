import { InvalidRubricError } from '../shared/DomainError';
import type { DimensionId } from '../shared/ids';
import { TOTAL_RUBRIC_WEIGHT } from '../shared/scoring';
import type { EvaluationDimension } from './EvaluationDimension';

/**
 * The fixed standard a problem's submissions are judged against.
 *
 * The rubric belongs to the Problem, not to an evaluation run. That is what
 * makes two attempts at the same problem comparable: the goalposts are defined
 * once, up front, and every attempt is measured against the same ones.
 */
export class EvaluationRubric {
  readonly dimensions: readonly EvaluationDimension[];

  private readonly byId: ReadonlyMap<DimensionId, EvaluationDimension>;

  constructor(dimensions: EvaluationDimension[]) {
    if (dimensions.length === 0) {
      throw new InvalidRubricError('A rubric must define at least one dimension');
    }

    const byId = new Map<DimensionId, EvaluationDimension>();
    for (const dimension of dimensions) {
      if (byId.has(dimension.id)) {
        throw new InvalidRubricError(`Duplicate dimension id in rubric: ${dimension.id}`);
      }
      byId.set(dimension.id, dimension);
    }

    const totalWeight = dimensions.reduce((sum, dimension) => sum + dimension.weight, 0);
    // Guard against float drift from percentages such as 33.33.
    if (Math.abs(totalWeight - TOTAL_RUBRIC_WEIGHT) > 0.01) {
      throw new InvalidRubricError(
        `Rubric weights sum to ${totalWeight}, expected ${TOTAL_RUBRIC_WEIGHT}. ` +
          `An unbalanced rubric would make overall scores incomparable between problems.`,
      );
    }

    this.dimensions = Object.freeze([...dimensions]);
    this.byId = byId;
  }

  get dimensionIds(): DimensionId[] {
    return this.dimensions.map((dimension) => dimension.id);
  }

  has(dimensionId: DimensionId): boolean {
    return this.byId.has(dimensionId);
  }

  /** Returns undefined for unknown ids; callers decide whether that is an error. */
  find(dimensionId: DimensionId): EvaluationDimension | undefined {
    return this.byId.get(dimensionId);
  }

  /** Throws for unknown ids. Use when the dimension is required to exist. */
  get(dimensionId: DimensionId): EvaluationDimension {
    const dimension = this.byId.get(dimensionId);
    if (!dimension) {
      throw new InvalidRubricError(`Unknown dimension: ${dimensionId}`);
    }
    return dimension;
  }
}
