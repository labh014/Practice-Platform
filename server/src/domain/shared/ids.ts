/**
 * Identifier aliases.
 *
 * These are plain string aliases rather than branded types. Branding would add
 * a cast at every construction site across the codebase in exchange for
 * catching a class of mistake this MVP has little exposure to, since ids only
 * ever travel between a repository and a route handler. The aliases still
 * document intent at every signature, which is the part that pays for itself.
 */
export type ProblemId = string;
export type RequirementId = string;
export type DimensionId = string;
export type AttemptId = string;
export type UserId = string;
export type FeedbackItemId = string;
export type ChangeScenarioId = string;

/** The single learner this MVP serves. Authentication is out of scope (PRD 2.2). */
export const DEFAULT_USER_ID: UserId = 'learner_1';
