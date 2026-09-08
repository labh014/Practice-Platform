import type { Attempt, AttemptId, ProblemId, UserId } from '../domain';

/**
 * Persistence for attempts.
 *
 * Every method is async even though the MVP stores attempts in a Map. The PRD
 * rules out a real database, but the point of the interface is that introducing
 * one later should not ripple into the application service - and a synchronous
 * contract would guarantee that it did. This is the one place where designing
 * for a change that has not happened yet costs nothing.
 *
 * The read methods are shaped around the questions the product actually asks:
 * how many attempts has this learner made at this problem, and what did the
 * last completed one score. Both exist because the practice loop is about
 * improvement over time, so history is a first-class query rather than a
 * filter applied over everything.
 */
export interface IAttemptRepository {
  save(attempt: Attempt): Promise<Attempt>;

  findById(attemptId: AttemptId): Promise<Attempt | null>;

  /** All attempts by this learner at this problem, oldest first. */
  findByProblemAndUser(problemId: ProblemId, userId: UserId): Promise<Attempt[]>;

  /** The number the next attempt should carry. 1 when there are none. */
  nextAttemptNumber(problemId: ProblemId, userId: UserId): Promise<number>;

  /**
   * The most recent COMPLETED attempt, which is what a new attempt is compared
   * against. Attempts that failed evaluation are skipped: comparing against an
   * attempt with no result would mean inventing scores that were never awarded.
   *
   * `beforeAttemptNumber` restricts the search to attempts made earlier, which
   * matters on retry. Re-evaluating a failed attempt 2 must compare against
   * attempt 1, not against an attempt 3 that has since completed - otherwise
   * the delta would claim the learner regressed against work they had not yet
   * done.
   */
  findLatestCompleted(
    problemId: ProblemId,
    userId: UserId,
    beforeAttemptNumber?: number,
  ): Promise<Attempt | null>;

  /** Every attempt by this learner, newest first. Used for catalogue summaries. */
  findAllByUser(userId: UserId): Promise<Attempt[]>;
}
