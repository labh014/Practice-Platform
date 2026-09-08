import { type Attempt, type AttemptId, AttemptStatus, type ProblemId, type UserId } from '../domain';
import type { IAttemptRepository } from './IAttemptRepository';

/**
 * Attempt storage backed by a Map, per PRD 2.1.
 *
 * Two properties are worth stating plainly rather than discovering later.
 *
 * Attempts are stored by reference, not copied. Because Attempt is a mutable
 * aggregate that owns its own state machine, a caller holding one and calling
 * `beginEvaluation()` changes what this repository returns without calling
 * `save()` again. That is a real difference from a database and it is the
 * honest trade for not having one; `save()` is still called at each transition
 * so the code reads correctly against a persistent implementation later.
 *
 * Storage is process-scoped. Attempts survive a failed evaluation and a retry,
 * which is what the learner-facing guarantee actually requires, but not a
 * server restart.
 */
export class InMemoryAttemptRepository implements IAttemptRepository {
  private readonly attempts = new Map<AttemptId, Attempt>();

  // eslint-disable-next-line @typescript-eslint/require-await -- async by contract, not by need
  async save(attempt: Attempt): Promise<Attempt> {
    this.attempts.set(attempt.id, attempt);
    return attempt;
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async findById(attemptId: AttemptId): Promise<Attempt | null> {
    return this.attempts.get(attemptId) ?? null;
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async findByProblemAndUser(problemId: ProblemId, userId: UserId): Promise<Attempt[]> {
    return this.matching(problemId, userId).sort((a, b) => a.attemptNumber - b.attemptNumber);
  }

  async nextAttemptNumber(problemId: ProblemId, userId: UserId): Promise<number> {
    const existing = await this.findByProblemAndUser(problemId, userId);
    const highest = existing.reduce((max, attempt) => Math.max(max, attempt.attemptNumber), 0);

    return highest + 1;
  }

  async findLatestCompleted(problemId: ProblemId, userId: UserId): Promise<Attempt | null> {
    const completed = (await this.findByProblemAndUser(problemId, userId)).filter(
      (attempt) => attempt.status === AttemptStatus.COMPLETED && attempt.result !== null,
    );

    return completed.at(-1) ?? null;
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async findAllByUser(userId: UserId): Promise<Attempt[]> {
    return [...this.attempts.values()]
      .filter((attempt) => attempt.userId === userId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  /** Test and diagnostic helper. Not part of the interface. */
  get size(): number {
    return this.attempts.size;
  }

  clear(): void {
    this.attempts.clear();
  }

  private matching(problemId: ProblemId, userId: UserId): Attempt[] {
    return [...this.attempts.values()].filter(
      (attempt) => attempt.problemId === problemId && attempt.userId === userId,
    );
  }
}
