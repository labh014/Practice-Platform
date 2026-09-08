import { beforeEach, describe, expect, it } from 'vitest';

import {
  Attempt,
  AttemptStatus,
  DimensionScore,
  EvaluationResult,
  type Submission,
} from '../domain';
import { godClassSubmission, wellSeparatedSubmission } from '../testing/fixtures';
import { InMemoryAttemptRepository } from './InMemoryAttemptRepository';

const PROBLEM = 'parking-lot';
const OTHER_PROBLEM = 'vending-machine';
const LEARNER = 'learner_1';

let repository: InMemoryAttemptRepository;

beforeEach(() => {
  repository = new InMemoryAttemptRepository();
});

function attempt(params: {
  id: string;
  attemptNumber: number;
  problemId?: string;
  userId?: string;
  submission?: Submission;
}): Attempt {
  return new Attempt({
    id: params.id,
    problemId: params.problemId ?? PROBLEM,
    userId: params.userId ?? LEARNER,
    attemptNumber: params.attemptNumber,
    submission: params.submission ?? godClassSubmission(),
  });
}

function completedResult(overallScore: number): EvaluationResult {
  return new EvaluationResult({
    overallScore,
    dimensionScores: [
      new DimensionScore({
        dimensionId: 'responsibility-cohesion',
        score: 3,
        justification: 'Middle of the rubric.',
      }),
    ],
    strengths: [],
    feedback: [],
    tradeOffs: [],
    evaluatorModel: 'mock',
  });
}

async function complete(target: Attempt, score: number): Promise<void> {
  target.beginEvaluation();
  target.completeWith(completedResult(score));
  await repository.save(target);
}

describe('InMemoryAttemptRepository', () => {
  it('saves an attempt and retrieves it by id', async () => {
    // PRD 7.2.
    const saved = await repository.save(attempt({ id: 'a1', attemptNumber: 1 }));
    const found = await repository.findById('a1');

    expect(found).not.toBeNull();
    expect(found?.id).toBe(saved.id);
    expect(found?.submission.designSkeleton).toContain('ParkingLot');
  });

  it('returns null for an unknown id rather than throwing', async () => {
    expect(await repository.findById('does-not-exist')).toBeNull();
  });

  it('preserves the submission verbatim through a round trip', async () => {
    const submission = wellSeparatedSubmission();
    await repository.save(attempt({ id: 'a1', attemptNumber: 1, submission }));

    const found = await repository.findById('a1');

    expect(found?.submission.designSkeleton).toBe(submission.designSkeleton);
    expect(found?.submission.designDecisions).toBe(submission.designDecisions);
    expect(found?.submission.assumptions).toBe(submission.assumptions);
  });

  it('lists a learner attempts at a problem oldest first', async () => {
    await repository.save(attempt({ id: 'a3', attemptNumber: 3 }));
    await repository.save(attempt({ id: 'a1', attemptNumber: 1 }));
    await repository.save(attempt({ id: 'a2', attemptNumber: 2 }));

    const found = await repository.findByProblemAndUser(PROBLEM, LEARNER);

    expect(found.map((item) => item.attemptNumber)).toEqual([1, 2, 3]);
  });

  it('scopes queries to one problem', async () => {
    await repository.save(attempt({ id: 'a1', attemptNumber: 1 }));
    await repository.save(attempt({ id: 'b1', attemptNumber: 1, problemId: OTHER_PROBLEM }));

    expect(await repository.findByProblemAndUser(PROBLEM, LEARNER)).toHaveLength(1);
    expect(await repository.findByProblemAndUser(OTHER_PROBLEM, LEARNER)).toHaveLength(1);
  });

  it('scopes queries to one learner', async () => {
    await repository.save(attempt({ id: 'a1', attemptNumber: 1 }));
    await repository.save(attempt({ id: 'z1', attemptNumber: 1, userId: 'learner_2' }));

    expect(await repository.findByProblemAndUser(PROBLEM, LEARNER)).toHaveLength(1);
  });

  it('starts attempt numbering at 1 and increments per problem', async () => {
    expect(await repository.nextAttemptNumber(PROBLEM, LEARNER)).toBe(1);

    await repository.save(attempt({ id: 'a1', attemptNumber: 1 }));
    expect(await repository.nextAttemptNumber(PROBLEM, LEARNER)).toBe(2);

    // A different problem keeps its own sequence.
    expect(await repository.nextAttemptNumber(OTHER_PROBLEM, LEARNER)).toBe(1);
  });

  it('returns the most recent completed attempt', async () => {
    const first = attempt({ id: 'a1', attemptNumber: 1 });
    const second = attempt({ id: 'a2', attemptNumber: 2 });

    await complete(first, 45);
    await complete(second, 70);

    const latest = await repository.findLatestCompleted(PROBLEM, LEARNER);

    expect(latest?.id).toBe('a2');
    expect(latest?.result?.overallScore).toBe(70);
  });

  it('skips failed attempts when finding the last completed one', async () => {
    // Comparing against an attempt with no result would mean inventing scores
    // that were never awarded.
    const first = attempt({ id: 'a1', attemptNumber: 1 });
    await complete(first, 45);

    const second = attempt({ id: 'a2', attemptNumber: 2 });
    second.beginEvaluation();
    second.failWith('Model returned malformed JSON');
    await repository.save(second);

    const latest = await repository.findLatestCompleted(PROBLEM, LEARNER);

    expect(latest?.id).toBe('a1');
  });

  it('returns null when nothing has completed yet', async () => {
    const only = attempt({ id: 'a1', attemptNumber: 1 });
    only.beginEvaluation();
    only.failWith('Provider unavailable');
    await repository.save(only);

    expect(await repository.findLatestCompleted(PROBLEM, LEARNER)).toBeNull();
  });

  it('keeps a failed attempt and its submission available for retry', async () => {
    const failed = attempt({ id: 'a1', attemptNumber: 1 });
    failed.beginEvaluation();
    failed.failWith('Provider unavailable');
    await repository.save(failed);

    const found = await repository.findById('a1');

    expect(found?.status).toBe(AttemptStatus.FAILED);
    expect(found?.isRetryable).toBe(true);
    expect(found?.submission.designSkeleton).toContain('ParkingLot');
  });

  it('lists every attempt by a learner newest first', async () => {
    const older = new Attempt({
      id: 'a1',
      problemId: PROBLEM,
      userId: LEARNER,
      attemptNumber: 1,
      submission: godClassSubmission(),
      createdAt: new Date('2026-01-01T10:00:00Z'),
    });
    const newer = new Attempt({
      id: 'b1',
      problemId: OTHER_PROBLEM,
      userId: LEARNER,
      attemptNumber: 1,
      submission: godClassSubmission(),
      createdAt: new Date('2026-01-02T10:00:00Z'),
    });

    await repository.save(older);
    await repository.save(newer);

    expect((await repository.findAllByUser(LEARNER)).map((item) => item.id)).toEqual(['b1', 'a1']);
  });

  it('overwrites rather than duplicating when the same attempt is saved twice', async () => {
    const target = attempt({ id: 'a1', attemptNumber: 1 });

    await repository.save(target);
    target.beginEvaluation();
    await repository.save(target);

    expect(repository.size).toBe(1);
    expect((await repository.findById('a1'))?.status).toBe(AttemptStatus.EVALUATING);
  });
});
