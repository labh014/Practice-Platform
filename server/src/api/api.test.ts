import type { Express } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';

import { createApp } from '../app';
import { type Container, createContainer } from '../container';
import { AttemptStatus } from '../domain';
import { MockLlmClient } from '../evaluation';
import { FailingLlmClient, StubLlmClient } from '../testing/stubs';
import { godClassSubmission, wellSeparatedSubmission } from '../testing/fixtures';
import type { LlmClient } from '../evaluation';

/**
 * Evaluation normally runs on the event loop after the response is sent. Tests
 * collect the scheduled task instead and run it on demand, so assertions are
 * made against a settled attempt rather than against a race.
 */
class ManualDispatcher {
  private readonly queue: Array<() => void> = [];

  readonly dispatch = (task: () => void): void => {
    this.queue.push(task);
  };

  /** Runs everything queued and lets the resulting promises settle. */
  async drain(): Promise<void> {
    while (this.queue.length > 0) {
      this.queue.shift()?.();
      // Two ticks: one for the evaluation chain, one for the final save.
      await new Promise((resolve) => setTimeout(resolve, 0));
      await new Promise((resolve) => setImmediate(resolve));
    }
  }
}

let app: Express;
let container: Container;
let dispatcher: ManualDispatcher;

function boot(llmClient: LlmClient = new MockLlmClient()): void {
  dispatcher = new ManualDispatcher();
  container = createContainer({ llmClient, dispatch: dispatcher.dispatch });
  app = createApp(container);
}

beforeEach(() => {
  boot();
});

/** A schema-valid evaluation quoting the God-class submission, for stub clients. */
function validEvaluationJson(): string {
  return JSON.stringify({
    dimensionScores: [
      'responsibility-cohesion',
      'coupling-abstraction',
      'requirement-completeness',
      'extensibility-tradeoffs',
    ].map((dimensionId) => ({
      dimensionId,
      score: 3,
      justification: 'Competent but unremarkable against this dimension.',
    })),
    strengths: ['The end-to-end flow is readable in one place.'],
    feedback: [
      {
        dimensionId: 'responsibility-cohesion',
        severity: 'CRITICAL',
        category: 'COHESION',
        evidence: 'processPayment(Ticket t, Card c)',
        issue: 'ParkingLot owns payment processing alongside allocation.',
        whyItMatters: 'Pricing and allocation rules change on different schedules.',
        suggestion: 'Extract payment behind its own collaborator.',
        principle: 'Single Responsibility Principle',
        pattern: null,
      },
    ],
    tradeOffs: [],
  });
}

async function submit(
  overrides?: Partial<{
    problemId: string;
    designSkeleton: string;
    designDecisions: string;
    assumptions: string;
  }>,
): Promise<string> {
  const submission = godClassSubmission();

  const response = await request(app)
    .post('/api/attempts')
    .send({
      problemId: overrides?.problemId ?? 'parking-lot',
      designSkeleton: overrides?.designSkeleton ?? submission.designSkeleton,
      designDecisions: overrides?.designDecisions ?? submission.designDecisions,
      assumptions: overrides?.assumptions ?? submission.assumptions,
    })
    .expect(202);

  return response.body.attemptId as string;
}

describe('GET /api/problems', () => {
  it('lists the seeded problems with no attempts yet', async () => {
    const response = await request(app).get('/api/problems').expect(200);

    expect(response.body.length).toBeGreaterThanOrEqual(2);
    const parkingLot = response.body.find((p: { id: string }) => p.id === 'parking-lot');
    expect(parkingLot).toMatchObject({
      id: 'parking-lot',
      attemptCount: 0,
      bestScore: null,
      latestStatus: null,
    });
  });

  it('reflects progress once an attempt has been evaluated', async () => {
    await submit();
    await dispatcher.drain();

    const response = await request(app).get('/api/problems').expect(200);
    const parkingLot = response.body.find((p: { id: string }) => p.id === 'parking-lot');

    expect(parkingLot.attemptCount).toBe(1);
    expect(parkingLot.bestScore).toBeGreaterThan(0);
    expect(parkingLot.latestStatus).toBe(AttemptStatus.COMPLETED);
  });
});

describe('GET /api/problems/:problemId', () => {
  it('returns requirements and rubric dimensions with their bands', async () => {
    const response = await request(app).get('/api/problems/parking-lot').expect(200);

    expect(response.body.requirements).toHaveLength(5);
    expect(response.body.dimensions).toHaveLength(4);
    expect(response.body.dimensions[0].bands).toHaveLength(3);
    expect(response.body.dimensions[0].bands[0].descriptor).toBeTruthy();
  });

  it('withholds the change scenario before the first attempt', async () => {
    // Gated server-side, not just hidden in the UI. The scenario is the
    // extensibility question; a learner reading the network tab would otherwise
    // be handed the answer to what their first attempt is meant to measure.
    const response = await request(app).get('/api/problems/parking-lot').expect(200);

    expect(response.body.changeScenario).toBeNull();
    expect(response.body.changeScenarioActive).toBe(false);
  });

  it('reveals the change scenario once an attempt exists', async () => {
    await submit();
    await dispatcher.drain();

    const response = await request(app).get('/api/problems/parking-lot').expect(200);

    expect(response.body.changeScenario).not.toBeNull();
    expect(response.body.changeScenario.title).toBe('EV charging spots');
    expect(response.body.changeScenarioActive).toBe(true);
  });

  it('404s for an unknown problem', async () => {
    const response = await request(app).get('/api/problems/elevator').expect(404);

    expect(response.body.error.code).toBe('NOT_FOUND');
  });
});

describe('POST /api/attempts', () => {
  it('accepts a submission and returns immediately without evaluating', async () => {
    const response = await request(app)
      .post('/api/attempts')
      .send({
        problemId: 'parking-lot',
        designSkeleton: godClassSubmission().designSkeleton,
        designDecisions: 'Kept it simple.',
        assumptions: 'One lot.',
      })
      .expect(202);

    expect(response.body.attemptId).toBeTruthy();
    expect(response.body.status).toBe(AttemptStatus.SUBMITTED);
    expect(response.body.attemptNumber).toBe(1);
  });

  it('numbers attempts per problem', async () => {
    await submit();
    await dispatcher.drain();

    const second = await request(app)
      .post('/api/attempts')
      .send({ problemId: 'parking-lot', designSkeleton: 'class A { go() {} }' })
      .expect(202);

    expect(second.body.attemptNumber).toBe(2);

    const otherProblem = await request(app)
      .post('/api/attempts')
      .send({ problemId: 'vending-machine', designSkeleton: 'class B { go() {} }' })
      .expect(202);

    expect(otherProblem.body.attemptNumber).toBe(1);
  });

  it('accepts an empty submission and evaluates it rather than rejecting it', async () => {
    // PRD 7.1 with 4.1: emptiness is something the platform reports on, not
    // something it refuses. A scored explanation teaches more than a 400.
    const attemptId = await submit({
      designSkeleton: '',
      designDecisions: '',
      assumptions: '',
    });
    await dispatcher.drain();

    const response = await request(app).get(`/api/attempts/${attemptId}`).expect(200);

    expect(response.body.status).toBe(AttemptStatus.COMPLETED);
    expect(response.body.result.overallScore).toBe(0);
    expect(response.body.structuralFindings[0].code).toBe('EMPTY_SUBMISSION');
  });

  it('400s when problemId is missing', async () => {
    const response = await request(app)
      .post('/api/attempts')
      .send({ designSkeleton: 'class A {}' })
      .expect(400);

    expect(response.body.error.code).toBe('INVALID_REQUEST');
    expect(response.body.error.details).toContain('problemId: problemId is required');
  });

  it('404s for an unknown problem', async () => {
    await request(app)
      .post('/api/attempts')
      .send({ problemId: 'elevator', designSkeleton: 'class A {}' })
      .expect(404);
  });

  it('rejects an unreasonably large field rather than storing it', async () => {
    await request(app)
      .post('/api/attempts')
      .send({ problemId: 'parking-lot', designSkeleton: 'x'.repeat(20_001) })
      .expect(400);
  });
});

describe('duplicate submissions', () => {
  it('returns the in-flight attempt instead of creating a second one', async () => {
    // A double-clicked button, or a retried request. Both arrive while the first
    // attempt is still pending. A second attempt would spend a second evaluation
    // on identical text and leave a phantom entry in the learner's history.
    const body = {
      problemId: 'parking-lot',
      designSkeleton: godClassSubmission().designSkeleton,
      designDecisions: godClassSubmission().designDecisions,
      assumptions: godClassSubmission().assumptions,
    };

    const first = await request(app).post('/api/attempts').send(body).expect(202);
    const second = await request(app).post('/api/attempts').send(body).expect(202);

    expect(second.body.attemptId).toBe(first.body.attemptId);
    expect(second.body.attemptNumber).toBe(1);

    await dispatcher.drain();

    const history = await request(app)
      .get('/api/problems/parking-lot/attempts?userId=learner_1')
      .expect(200);

    expect(history.body).toHaveLength(1);
  });

  it('treats a different submission as a new attempt', async () => {
    await submit();
    const different = await request(app)
      .post('/api/attempts')
      .send({ problemId: 'parking-lot', designSkeleton: 'class Other { go() {} }' })
      .expect(202);

    expect(different.body.attemptNumber).toBe(2);
  });

  it('treats the same design resubmitted after feedback as a new attempt', async () => {
    // Not a duplicate request. Resubmitting identical text after reading the
    // feedback is a deliberate act, and the learner is entitled to a new attempt.
    const first = await submit();
    await dispatcher.drain();

    const again = await submit();

    expect(again).not.toBe(first);
  });
});

describe('GET /api/attempts/:attemptId', () => {
  it('returns the full evaluation once it completes', async () => {
    const attemptId = await submit();
    await dispatcher.drain();

    const response = await request(app).get(`/api/attempts/${attemptId}`).expect(200);

    expect(response.body.status).toBe(AttemptStatus.COMPLETED);
    expect(response.body.result.dimensionScores).toHaveLength(4);
    expect(response.body.result.feedback.length).toBeGreaterThan(0);
    expect(response.body.result.comparison).toBeNull();
  });

  it('sends each dimension score with the band that defines it', async () => {
    // A bare number is a verdict. The band text is what makes it arguable.
    const attemptId = await submit();
    await dispatcher.drain();

    const response = await request(app).get(`/api/attempts/${attemptId}`).expect(200);
    const [firstScore] = response.body.result.dimensionScores;

    expect(firstScore.bandDescriptor).toBeTruthy();
    expect(firstScore.dimensionName).toBe('Responsibility & Cohesion');
    expect(firstScore.maxScore).toBe(5);
    expect(firstScore.weight).toBe(25);
  });

  it('returns the submission verbatim so the design stays on screen', async () => {
    const attemptId = await submit();
    await dispatcher.drain();

    const response = await request(app).get(`/api/attempts/${attemptId}`).expect(200);

    expect(response.body.submission.designSkeleton).toBe(godClassSubmission().designSkeleton);
  });

  it('reports EVALUATING while the work is still queued', async () => {
    const attemptId = await submit();

    const response = await request(app).get(`/api/attempts/${attemptId}`).expect(200);

    expect(response.body.status).toBe(AttemptStatus.SUBMITTED);
    expect(response.body.result).toBeNull();
  });

  it('404s for an unknown attempt', async () => {
    await request(app).get('/api/attempts/not-a-real-id').expect(404);
  });
});

describe('GET /api/problems/:problemId/attempts', () => {
  it('returns history oldest first with scores', async () => {
    await submit();
    await dispatcher.drain();
    await submit({ designSkeleton: wellSeparatedSubmission().designSkeleton });
    await dispatcher.drain();

    const response = await request(app)
      .get('/api/problems/parking-lot/attempts?userId=learner_1')
      .expect(200);

    expect(response.body).toHaveLength(2);
    expect(response.body.map((a: { attemptNumber: number }) => a.attemptNumber)).toEqual([1, 2]);
    expect(response.body[0].overallScore).toBeGreaterThanOrEqual(0);
    expect(response.body[0].dimensionScores).toHaveLength(4);
  });

  it('scopes history to the requested learner', async () => {
    await submit();
    await dispatcher.drain();

    const response = await request(app)
      .get('/api/problems/parking-lot/attempts?userId=someone_else')
      .expect(200);

    expect(response.body).toHaveLength(0);
  });
});

describe('the improvement loop', () => {
  it('compares a revised attempt against the previous one', async () => {
    await submit();
    await dispatcher.drain();

    const secondId = await submit({
      designSkeleton: wellSeparatedSubmission().designSkeleton,
      designDecisions: wellSeparatedSubmission().designDecisions,
      assumptions: wellSeparatedSubmission().assumptions,
    });
    await dispatcher.drain();

    const response = await request(app).get(`/api/attempts/${secondId}`).expect(200);
    const comparison = response.body.result.comparison;

    expect(comparison).not.toBeNull();
    expect(comparison.previousAttemptNumber).toBe(1);
    expect(comparison.hasImproved).toBe(true);
    expect(comparison.overallDelta).toBeGreaterThan(0);
    expect(comparison.dimensionDeltas).toHaveLength(4);
  });

  it('marks the probed dimension as scope-changed on the second attempt', async () => {
    await submit();
    await dispatcher.drain();
    const secondId = await submit({
      designSkeleton: wellSeparatedSubmission().designSkeleton,
    });
    await dispatcher.drain();

    const response = await request(app).get(`/api/attempts/${secondId}`).expect(200);
    const extensibility = response.body.result.comparison.dimensionDeltas.find(
      (d: { dimensionId: string }) => d.dimensionId === 'extensibility-tradeoffs',
    );

    expect(extensibility.scopeChanged).toBe(true);
  });
});

describe('failure and retry', () => {
  it('marks an attempt FAILED without losing the submission', async () => {
    boot(new FailingLlmClient('provider timed out'));

    const attemptId = await submit();
    await dispatcher.drain();

    const response = await request(app).get(`/api/attempts/${attemptId}`).expect(200);

    expect(response.body.status).toBe(AttemptStatus.FAILED);
    expect(response.body.failureReason).toContain('provider timed out');
    expect(response.body.isRetryable).toBe(true);
    expect(response.body.submission.designSkeleton).toBe(godClassSubmission().designSkeleton);
  });

  it('keeps structural findings visible on a failed attempt', async () => {
    // A failed evaluation should never be a blank screen.
    boot(new FailingLlmClient());

    const attemptId = await submit();
    await dispatcher.drain();

    const response = await request(app).get(`/api/attempts/${attemptId}`).expect(200);

    expect(response.body.structuralFindings.length).toBeGreaterThan(0);
  });

  it('re-evaluates the stored submission on retry, with nothing retyped', async () => {
    // The first evaluation burns two responses - the initial call and its repair
    // round - and fails. The retry gets the third, which is valid. This is the
    // transient-provider-failure case the retry endpoint exists for.
    boot(new StubLlmClient(['not json', 'still not json', validEvaluationJson()]));

    const attemptId = await submit();
    await dispatcher.drain();

    const failed = await request(app).get(`/api/attempts/${attemptId}`).expect(200);
    expect(failed.body.status).toBe(AttemptStatus.FAILED);

    await request(app).post(`/api/attempts/${attemptId}/retry`).expect(202);
    await dispatcher.drain();

    const recovered = await request(app).get(`/api/attempts/${attemptId}`).expect(200);

    expect(recovered.body.status).toBe(AttemptStatus.COMPLETED);
    expect(recovered.body.result).not.toBeNull();
    // The submission survived untouched: the learner retyped nothing.
    expect(recovered.body.submission.designSkeleton).toBe(godClassSubmission().designSkeleton);
  });

  it('409s when retrying an attempt that did not fail', async () => {
    const attemptId = await submit();
    await dispatcher.drain();

    const response = await request(app).post(`/api/attempts/${attemptId}/retry`).expect(409);

    expect(response.body.error.code).toBe('CONFLICT');
    expect(response.body.error.message).toMatch(/only a failed attempt/i);
  });

  it('404s when retrying an unknown attempt', async () => {
    await request(app).post('/api/attempts/nope/retry').expect(404);
  });
});

describe('routing', () => {
  it('404s an unknown endpoint with a structured error', async () => {
    const response = await request(app).get('/api/nonsense').expect(404);

    expect(response.body.error.code).toBe('NOT_FOUND');
  });

  it('serves the health check', async () => {
    const response = await request(app).get('/api/health').expect(200);

    expect(response.body.status).toBe('ok');
  });

  it('reports which evaluator is answering, so the UI can say so', async () => {
    // Rule-based feedback is indistinguishable from a model's in the UI. The
    // client needs to be told which one produced it, or a learner is invited to
    // trust a judgement the rules were never able to make.
    const response = await request(app).get('/api/health').expect(200);

    expect(response.body.evaluator).toEqual({ name: 'mock', isOffline: true });
  });

  it('does not flag a real model as offline', async () => {
    boot(new StubLlmClient([validEvaluationJson()]));

    const response = await request(app).get('/api/health').expect(200);

    expect(response.body.evaluator.isOffline).toBe(false);
    expect(response.body.evaluator.name).toBe('stub');
  });
});
