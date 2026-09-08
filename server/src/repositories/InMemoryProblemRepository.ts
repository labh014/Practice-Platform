import type { Problem, ProblemId } from '../domain';
import { buildSeedProblems } from '../seed';
import type { IProblemRepository } from './IProblemRepository';

/**
 * The seeded problem catalogue.
 *
 * Problems are constructed once at startup, which means every rubric invariant -
 * weights summing to 100, bands covering the full 0-5 scale, a change scenario
 * naming a dimension that exists - is checked before the server accepts its
 * first request. A malformed rubric fails at boot with a clear message rather
 * than midway through a learner's evaluation.
 */
export class InMemoryProblemRepository implements IProblemRepository {
  private readonly problems: ReadonlyMap<ProblemId, Problem>;

  constructor(problems: Problem[] = buildSeedProblems()) {
    this.problems = new Map(problems.map((problem) => [problem.id, problem]));
  }

  // eslint-disable-next-line @typescript-eslint/require-await -- async by contract, not by need
  async findAll(): Promise<Problem[]> {
    return [...this.problems.values()];
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async findById(problemId: ProblemId): Promise<Problem | null> {
    return this.problems.get(problemId) ?? null;
  }
}
