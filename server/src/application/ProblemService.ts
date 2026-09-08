import type { Attempt, Problem, ProblemId, UserId } from '../domain';
import type { IAttemptRepository, IProblemRepository } from '../repositories';
import { NotFoundError } from './errors';

export interface ProblemWithProgress {
  readonly problem: Problem;
  readonly attempts: Attempt[];
}

/**
 * Reads over the problem catalogue.
 *
 * The list is joined with the learner's attempts because the first question the
 * catalogue has to answer is not "what problems exist" but "what should I do
 * next" - which needs what has been tried and how it went.
 */
export class ProblemService {
  private readonly problems: IProblemRepository;
  private readonly attempts: IAttemptRepository;

  constructor(params: { problems: IProblemRepository; attempts: IAttemptRepository }) {
    this.problems = params.problems;
    this.attempts = params.attempts;
  }

  async listWithProgress(userId: UserId): Promise<ProblemWithProgress[]> {
    const problems = await this.problems.findAll();

    return Promise.all(
      problems.map(async (problem) => ({
        problem,
        attempts: await this.attempts.findByProblemAndUser(problem.id, userId),
      })),
    );
  }

  async getById(problemId: ProblemId): Promise<Problem> {
    const problem = await this.problems.findById(problemId);
    if (!problem) {
      throw new NotFoundError(`Problem "${problemId}" does not exist`);
    }
    return problem;
  }

  /**
   * How many attempts the learner has made, which decides whether the change
   * scenario is revealed.
   */
  async latestAttemptNumber(problemId: ProblemId, userId: UserId): Promise<number> {
    const attempts = await this.attempts.findByProblemAndUser(problemId, userId);
    return attempts.at(-1)?.attemptNumber ?? 0;
  }
}
