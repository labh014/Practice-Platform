import { describe, expect, it } from 'vitest';

import { AttemptStatus, Severity } from '../../domain';
import {
  buildTestProblem,
  DIMENSION_IDS,
  emptySubmission,
  godClassSubmission,
  wellSeparatedSubmission,
} from '../../testing/fixtures';
import { FailingLlmClient, StubLlmClient } from '../../testing/stubs';
import { LlmEvaluator, EvaluationValidationError } from '../evaluators/LlmEvaluator';
import { StructuralEvaluator } from '../evaluators/StructuralEvaluator';
import { MockLlmClient } from '../llm/MockLlmClient';
import { EvaluationPromptBuilder } from '../prompt/EvaluationPromptBuilder';
import { EvaluationOrchestrator } from './EvaluationOrchestrator';
import { StructuralFindingCode } from '../evaluators/structuralChecks';

const problem = buildTestProblem();
const promptBuilder = new EvaluationPromptBuilder();

function orchestratorWith(client: StubLlmClient | MockLlmClient | FailingLlmClient) {
  return new EvaluationOrchestrator({
    evaluators: [
      new StructuralEvaluator(),
      new LlmEvaluator({ client, promptBuilder }),
    ],
    evaluatorModel: client.modelName,
  });
}

function validPayloadJson(overrides?: {
  evidence?: string;
  dimensionScores?: Array<{ dimensionId: string; score: number; justification: string }>;
}): string {
  return JSON.stringify({
    dimensionScores:
      overrides?.dimensionScores ??
      Object.values(DIMENSION_IDS).map((dimensionId) => ({
        dimensionId,
        score: 3,
        justification: 'Middle of the rubric.',
      })),
    strengths: ['Vehicle handling is explicit.'],
    feedback: [
      {
        dimensionId: DIMENSION_IDS.COHESION,
        severity: 'CRITICAL',
        category: 'COHESION',
        evidence: overrides?.evidence ?? 'processPayment(Ticket t, Card c)',
        issue: 'ParkingLot owns payment processing.',
        whyItMatters: 'Pricing and allocation change independently.',
        suggestion: 'Extract a PaymentProcessor.',
        principle: 'Single Responsibility Principle',
        pattern: null,
      },
    ],
    tradeOffs: [],
  });
}

describe('EvaluationOrchestrator', () => {
  it('produces a complete result from the offline mock, with no network', async () => {
    const outcome = await orchestratorWith(new MockLlmClient()).evaluate({
      problem,
      submission: godClassSubmission(),
      attemptNumber: 1,
      previous: null,
    });

    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;

    expect(outcome.result.dimensionScores).toHaveLength(4);
    expect(outcome.result.feedback.length).toBeGreaterThan(0);
    expect(outcome.result.overallScore).toBeGreaterThanOrEqual(0);
    expect(outcome.result.overallScore).toBeLessThanOrEqual(100);
    expect(outcome.result.comparison).toBeNull();
  });

  it('derives the overall score from the dimension scores it was given', async () => {
    // All fours at 25% each = 80. The number is arithmetic, not the model's word.
    const client = new StubLlmClient([
      validPayloadJson({
        dimensionScores: Object.values(DIMENSION_IDS).map((dimensionId) => ({
          dimensionId,
          score: 4,
          justification: 'Solid.',
        })),
      }),
    ]);

    const outcome = await orchestratorWith(client).evaluate({
      problem,
      submission: godClassSubmission(),
      attemptNumber: 1,
      previous: null,
    });

    expect(outcome.ok && outcome.result.overallScore).toBe(80);
  });

  it('discards feedback quoting a class the learner never wrote', async () => {
    const client = new StubLlmClient([
      validPayloadJson({ evidence: 'class BookingService { reserve(); }' }),
    ]);

    const outcome = await orchestratorWith(client).evaluate({
      problem,
      submission: godClassSubmission(),
      attemptNumber: 1,
      previous: null,
    });

    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;

    expect(outcome.result.feedback).toHaveLength(0);
    expect(outcome.discardedEvidenceCount).toBe(1);
  });

  it('passes structural findings into the semantic pass as context', async () => {
    const client = new StubLlmClient([validPayloadJson()]);

    await orchestratorWith(client).evaluate({
      problem,
      submission: godClassSubmission(),
      attemptNumber: 1,
      previous: null,
    });

    expect(client.promptsReceived[0]?.user).toContain('Automated structural checks');
    expect(client.promptsReceived[0]?.user).toContain('The whole design sits in a single type.');
  });

  it('keeps structural findings when the semantic pass fails', async () => {
    // Assumption A10. A failed evaluation must still show the learner the
    // objective observations about their submission rather than a blank screen.
    const outcome = await orchestratorWith(new FailingLlmClient()).evaluate({
      problem,
      submission: emptySubmission(),
      attemptNumber: 1,
      previous: null,
    });

    expect(outcome.ok).toBe(false);
    expect(outcome.structuralFindings.map((finding) => finding.code)).toContain(
      StructuralFindingCode.EMPTY_SUBMISSION,
    );
  });

  it('reports a provider outage as a failure rather than throwing', async () => {
    const outcome = await orchestratorWith(new FailingLlmClient('rate limited')).evaluate({
      problem,
      submission: godClassSubmission(),
      attemptNumber: 1,
      previous: null,
    });

    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.reason).toContain('rate limited');
  });

  it('builds a comparison report when a previous attempt exists', async () => {
    const first = await orchestratorWith(new MockLlmClient()).evaluate({
      problem,
      submission: godClassSubmission(),
      attemptNumber: 1,
      previous: null,
    });

    expect(first.ok).toBe(true);
    if (!first.ok) return;

    const second = await orchestratorWith(new MockLlmClient()).evaluate({
      problem,
      submission: wellSeparatedSubmission(),
      attemptNumber: 2,
      previous: {
        attemptId: 'a1',
        attemptNumber: 1,
        result: first.result,
        changeScenarioDimensionId: null,
      },
    });

    expect(second.ok).toBe(true);
    if (!second.ok) return;

    const comparison = second.result.comparison;
    expect(comparison).not.toBeNull();
    expect(comparison?.previousAttemptNumber).toBe(1);
    // A God class revised into separated types should measurably improve.
    expect(comparison?.hasImproved).toBe(true);
    expect(comparison?.resolvedCategories.length).toBeGreaterThan(0);
  });

  it('marks the probed dimension as scope-changed from the second attempt', async () => {
    const first = await orchestratorWith(new MockLlmClient()).evaluate({
      problem,
      submission: godClassSubmission(),
      attemptNumber: 1,
      previous: null,
    });
    if (!first.ok) throw new Error('setup failed');

    const second = await orchestratorWith(new MockLlmClient()).evaluate({
      problem,
      submission: wellSeparatedSubmission(),
      attemptNumber: 2,
      previous: {
        attemptId: 'a1',
        attemptNumber: 1,
        result: first.result,
        changeScenarioDimensionId: null,
      },
    });
    if (!second.ok) throw new Error('evaluation failed');

    const extensibility = second.result.comparison?.dimensionDeltas.find(
      (delta) => delta.dimensionId === DIMENSION_IDS.EXTENSIBILITY,
    );

    expect(extensibility?.scopeChanged).toBe(true);
  });

  it('sorts feedback so the most severe issue is read first', async () => {
    const outcome = await orchestratorWith(new MockLlmClient()).evaluate({
      problem,
      submission: godClassSubmission(),
      attemptNumber: 1,
      previous: null,
    });
    if (!outcome.ok) throw new Error('evaluation failed');

    const severities = outcome.result.feedback.map((item) => item.severity);
    const criticalIndex = severities.indexOf(Severity.CRITICAL);

    if (criticalIndex !== -1) {
      expect(criticalIndex).toBe(0);
    }
  });
});

describe('LlmEvaluator repair behaviour', () => {
  it('recovers from a malformed first response with one repair round', async () => {
    const client = new StubLlmClient(['not json at all', validPayloadJson()]);

    const outcome = await orchestratorWith(client).evaluate({
      problem,
      submission: godClassSubmission(),
      attemptNumber: 1,
      previous: null,
    });

    expect(outcome.ok).toBe(true);
    expect(client.callCount).toBe(2);
    expect(client.promptsReceived[1]?.user).toContain('Correction required');
  });

  it('repairs a response that omits a rubric dimension', async () => {
    const incomplete = validPayloadJson({
      dimensionScores: [
        {
          dimensionId: DIMENSION_IDS.COHESION,
          score: 2,
          justification: 'Only one dimension scored.',
        },
      ],
    });

    const client = new StubLlmClient([incomplete, validPayloadJson()]);

    const outcome = await orchestratorWith(client).evaluate({
      problem,
      submission: godClassSubmission(),
      attemptNumber: 1,
      previous: null,
    });

    expect(outcome.ok).toBe(true);
    expect(client.promptsReceived[1]?.user).toContain('missing required dimensionId');
  });

  it('rejects a response that tries to author its own overall score', async () => {
    // Assumption A2, enforced by the strict schema rather than by the prompt.
    const withOverall = JSON.stringify({
      ...JSON.parse(validPayloadJson()),
      overallScore: 91,
    });

    const client = new StubLlmClient([withOverall, validPayloadJson()]);

    const outcome = await orchestratorWith(client).evaluate({
      problem,
      submission: godClassSubmission(),
      attemptNumber: 1,
      previous: null,
    });

    expect(outcome.ok).toBe(true);
    expect(client.callCount).toBe(2);
    expect(outcome.ok && outcome.result.overallScore).not.toBe(91);
  });

  it('gives up after one repair rather than looping', async () => {
    const client = new StubLlmClient(['broken', 'still broken']);

    const outcome = await orchestratorWith(client).evaluate({
      problem,
      submission: godClassSubmission(),
      attemptNumber: 1,
      previous: null,
    });

    expect(outcome.ok).toBe(false);
    expect(client.callCount).toBe(2);
  });

  it('surfaces the validation failure as an EvaluationValidationError', async () => {
    const evaluator = new LlmEvaluator({
      client: new StubLlmClient(['broken', 'still broken']),
      promptBuilder,
    });

    await expect(
      evaluator.evaluate({
        problem,
        submission: godClassSubmission(),
        attemptNumber: 1,
        previousResult: null,
        structuralFindings: [],
        activeChangeScenario: null,
        isFirstAttempt: true,
        withStructuralFindings: () => {
          throw new Error('not used');
        },
      } as never),
    ).rejects.toBeInstanceOf(EvaluationValidationError);
  });
});

describe('attempt status vocabulary', () => {
  it('exposes the four statuses the API contract uses', () => {
    expect(Object.values(AttemptStatus)).toEqual([
      'SUBMITTED',
      'EVALUATING',
      'COMPLETED',
      'FAILED',
    ]);
  });
});
