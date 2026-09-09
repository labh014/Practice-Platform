import { randomUUID } from 'node:crypto';

import {
  Attempt,
  type AttemptId,
  AttemptStatus,
  type Problem,
  type ProblemId,
  Submission,
  type UserId,
} from '../domain';
import type { EvaluationOrchestrator } from '../evaluation';
import type { IAttemptRepository, IProblemRepository } from '../repositories';
import { ConflictError, NotFoundError } from './errors';

export interface SubmitAttemptCommand {
  readonly problemId: ProblemId;
  readonly userId: UserId;
  readonly designSkeleton: string;
  readonly designDecisions: string;
  readonly assumptions: string;
}

/**
 * The practice loop, as application logic.
 *
 * Submitting returns as soon as the attempt is stored, and evaluation runs
 * afterwards on the event loop. The learner's work being safe and the learner's
 * work being graded are two different guarantees, and only the first one should
 * make them wait - an evaluation that takes eight seconds should not be eight
 * seconds of a hanging request during which a refresh loses everything.
 *
 * This is the only class that mutates an Attempt. Keeping the state machine
 * driven from one place is what makes "an attempt is never left stuck in
 * EVALUATING" a property that can be reasoned about rather than hoped for.
 */
export class AttemptService {
  private readonly attempts: IAttemptRepository;
  private readonly problems: IProblemRepository;
  private readonly orchestrator: EvaluationOrchestrator;
  /** Injectable so tests can await evaluation instead of racing it. */
  private readonly dispatch: (task: () => void) => void;

  constructor(params: {
    attempts: IAttemptRepository;
    problems: IProblemRepository;
    orchestrator: EvaluationOrchestrator;
    dispatch?: (task: () => void) => void;
  }) {
    this.attempts = params.attempts;
    this.problems = params.problems;
    this.orchestrator = params.orchestrator;
    this.dispatch = params.dispatch ?? ((task) => setImmediate(task));
  }

  /**
   * Stores a submission and schedules its evaluation.
   *
   * Returns the attempt in SUBMITTED state. The client polls from there.
   */
  async submit(command: SubmitAttemptCommand): Promise<Attempt> {
    const problem = await this.requireProblem(command.problemId);

    const submission = Submission.create({
      designSkeleton: command.designSkeleton,
      designDecisions: command.designDecisions,
      assumptions: command.assumptions,
    });

    const inFlight = await this.findInFlightDuplicate(problem.id, command.userId, submission);
    if (inFlight) return inFlight;

    const attempt = new Attempt({
      id: randomUUID(),
      problemId: problem.id,
      userId: command.userId,
      attemptNumber: await this.attempts.nextAttemptNumber(problem.id, command.userId),
      submission,
    });

    await this.attempts.save(attempt);
    this.scheduleEvaluation(attempt, problem);

    return attempt;
  }

  /**
   * Re-runs evaluation on an attempt that failed.
   *
   * The stored submission is re-used, never re-entered. A learner whose
   * evaluation fell over because a provider timed out should not be asked to
   * retype the design they already submitted - that would make an infrastructure
   * problem into their problem.
   */
  async retry(attemptId: AttemptId): Promise<Attempt> {
    const attempt = await this.requireAttempt(attemptId);

    if (!attempt.isRetryable) {
      throw new ConflictError(
        `Attempt ${attemptId} is ${attempt.status} and cannot be re-evaluated. ` +
          `Only a FAILED attempt can be retried; revising a completed design starts ` +
          `a new attempt.`,
      );
    }

    const problem = await this.requireProblem(attempt.problemId);
    this.scheduleEvaluation(attempt, problem);

    return attempt;
  }

  async getById(attemptId: AttemptId): Promise<Attempt> {
    return this.requireAttempt(attemptId);
  }

  async listForProblem(problemId: ProblemId, userId: UserId): Promise<Attempt[]> {
    await this.requireProblem(problemId);
    return this.attempts.findByProblemAndUser(problemId, userId);
  }

  /**
   * The same submission, already submitted and still being evaluated.
   *
   * A double-clicked button or a retried request arrives milliseconds after the
   * first, while that attempt is still SUBMITTED or EVALUATING. Creating a
   * second attempt would spend a second evaluation on identical text and, worse,
   * put a phantom entry in the learner's history - which is meant to be a record
   * of how their thinking changed, not of how many times they clicked.
   *
   * Deliberately scoped to attempts still in flight. Resubmitting the same
   * design after reading its feedback is a real thing a learner might do - to
   * see whether the evaluator agrees with itself, say - and that is a new
   * attempt, not a duplicate request.
   */
  private async findInFlightDuplicate(
    problemId: ProblemId,
    userId: UserId,
    submission: Submission,
  ): Promise<Attempt | null> {
    const existing = await this.attempts.findByProblemAndUser(problemId, userId);
    const latest = existing.at(-1);

    if (latest && latest.isPending && latest.submission.equals(submission)) {
      return latest;
    }

    return null;
  }

  /**
   * Hands evaluation to the event loop.
   *
   * Nothing awaits the returned promise, so every failure path inside
   * `runEvaluation` has to be handled there. An unhandled rejection escaping
   * here would take the process down and lose every stored attempt with it.
   */
  private scheduleEvaluation(attempt: Attempt, problem: Problem): void {
    this.dispatch(() => {
      void this.runEvaluation(attempt, problem);
    });
  }

  private async runEvaluation(attempt: Attempt, problem: Problem): Promise<void> {
    try {
      attempt.beginEvaluation();
      await this.attempts.save(attempt);

      // Restricted to earlier attempts so a retry compares against the attempt
      // that preceded it, not one made afterwards.
      const previous = await this.attempts.findLatestCompleted(
        problem.id,
        attempt.userId,
        attempt.attemptNumber,
      );

      const outcome = await this.orchestrator.evaluate({
        problem,
        submission: attempt.submission,
        attemptNumber: attempt.attemptNumber,
        previous:
          previous && previous.result
            ? {
                attemptId: previous.id,
                attemptNumber: previous.attemptNumber,
                result: previous.result,
                changeScenarioDimensionId:
                  problem.activeChangeScenarioFor(previous.attemptNumber)?.probesDimensionId ??
                  null,
              }
            : null,
      });

      // Recorded before the branch: the deterministic observations are worth
      // showing whether or not the semantic pass succeeded.
      attempt.recordStructuralFindings([...outcome.structuralFindings]);

      if (outcome.ok) {
        attempt.completeWith(outcome.result);
      } else {
        attempt.failWith(outcome.reason);
      }

      await this.attempts.save(attempt);
    } catch (error) {
      await this.failSafely(attempt, error);
    }
  }

  /**
   * Last resort, for anything the orchestrator did not already turn into an
   * outcome.
   *
   * An attempt left in EVALUATING is the worst state available: it polls
   * forever, offers no retry, and gives the learner nothing to act on. Whatever
   * went wrong, the attempt ends somewhere it can be recovered from.
   */
  private async failSafely(attempt: Attempt, error: unknown): Promise<void> {
    const reason = error instanceof Error ? error.message : String(error);
    console.error(`[evaluation] attempt ${attempt.id} failed unexpectedly:`, reason);

    try {
      if (attempt.status === AttemptStatus.EVALUATING) {
        attempt.failWith(`Evaluation failed unexpectedly: ${reason}`);
        await this.attempts.save(attempt);
      }
    } catch (secondary) {
      console.error(`[evaluation] could not mark attempt ${attempt.id} as failed:`, secondary);
    }
  }

  private async requireProblem(problemId: ProblemId): Promise<Problem> {
    const problem = await this.problems.findById(problemId);
    if (!problem) {
      throw new NotFoundError(`Problem "${problemId}" does not exist`);
    }
    return problem;
  }

  private async requireAttempt(attemptId: AttemptId): Promise<Attempt> {
    const attempt = await this.attempts.findById(attemptId);
    if (!attempt) {
      throw new NotFoundError(`Attempt "${attemptId}" does not exist`);
    }
    return attempt;
  }
}
