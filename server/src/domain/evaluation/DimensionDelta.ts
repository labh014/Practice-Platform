import type { DimensionId } from '../shared/ids';

export const DeltaDirection = {
  IMPROVED: 'IMPROVED',
  REGRESSED: 'REGRESSED',
  UNCHANGED: 'UNCHANGED',
} as const;

export type DeltaDirection = (typeof DeltaDirection)[keyof typeof DeltaDirection];

/**
 * How one dimension moved between two attempts.
 *
 * Computed arithmetic over stored scores, never authored by the LLM. A model
 * asked to narrate its own improvement will find some, and the one claim this
 * product cannot afford to get wrong is whether the learner actually got better.
 */
export class DimensionDelta {
  readonly dimensionId: DimensionId;
  readonly dimensionName: string;
  readonly previousScore: number;
  readonly currentScore: number;
  /**
   * True when an active change scenario widened what this dimension is asking
   * for between the two attempts (assumption A1).
   *
   * Extensibility is judged against a harder question from attempt 2 onward -
   * "would this absorb EV charging?" - so a flat or lower score here is not
   * necessarily a regression. The flag lets the UI say so instead of showing a
   * red arrow the learner cannot make sense of.
   */
  readonly scopeChanged: boolean;

  constructor(params: {
    dimensionId: DimensionId;
    dimensionName: string;
    previousScore: number;
    currentScore: number;
    scopeChanged?: boolean;
  }) {
    this.dimensionId = params.dimensionId;
    this.dimensionName = params.dimensionName;
    this.previousScore = params.previousScore;
    this.currentScore = params.currentScore;
    this.scopeChanged = params.scopeChanged ?? false;
  }

  get delta(): number {
    return this.currentScore - this.previousScore;
  }

  get direction(): DeltaDirection {
    if (this.delta > 0) return DeltaDirection.IMPROVED;
    if (this.delta < 0) return DeltaDirection.REGRESSED;
    return DeltaDirection.UNCHANGED;
  }
}
