/**
 * Scoring scales, fixed in one place so the domain, the prompt, the score
 * calculator and the UI can never drift apart.
 *
 * Dimensions are scored 0-5 (PRD 6.2 shows "Coupling 4/5"). The overall score
 * is 0-100, derived from dimension scores weighted by the rubric. It is never
 * authored by the LLM - see WeightedScoreCalculator.
 */
export const MIN_DIMENSION_SCORE = 0;
export const MAX_DIMENSION_SCORE = 5;

export const MIN_OVERALL_SCORE = 0;
export const MAX_OVERALL_SCORE = 100;

/** Rubric dimension weights are percentages and must sum to this. */
export const TOTAL_RUBRIC_WEIGHT = 100;
