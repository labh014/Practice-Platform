/**
 * How much a requirement matters.
 *
 * Importance is surfaced to the learner as a badge and to the evaluator as
 * weighting context: missing a HIGH requirement should cost meaningfully more
 * under Requirement Completeness than missing a LOW one.
 */
export const Importance = {
  HIGH: 'HIGH',
  MEDIUM: 'MEDIUM',
  LOW: 'LOW',
} as const;

export type Importance = (typeof Importance)[keyof typeof Importance];

const ORDER: Record<Importance, number> = {
  [Importance.HIGH]: 0,
  [Importance.MEDIUM]: 1,
  [Importance.LOW]: 2,
};

/** Sort comparator placing HIGH first, so requirement lists read in priority order. */
export function compareImportance(a: Importance, b: Importance): number {
  return ORDER[a] - ORDER[b];
}
