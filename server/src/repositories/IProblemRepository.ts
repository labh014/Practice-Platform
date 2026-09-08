import type { Problem, ProblemId } from '../domain';

/**
 * Read-only access to the problem catalogue.
 *
 * There is no write side. Problems are authored content seeded at startup, not
 * user data, and the MVP has no authoring flow - so an interface offering
 * `save` would be advertising a capability nothing implements.
 */
export interface IProblemRepository {
  findAll(): Promise<Problem[]>;

  findById(problemId: ProblemId): Promise<Problem | null>;
}
