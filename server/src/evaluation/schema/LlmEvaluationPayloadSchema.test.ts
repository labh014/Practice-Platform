import { describe, expect, it } from 'vitest';

import { DIMENSION_IDS } from '../../testing/fixtures';
import {
  parseLlmEvaluationPayload,
  parseLlmEvaluationPayloadFromText,
} from './LlmEvaluationPayloadSchema';

function validPayload(): Record<string, unknown> {
  return {
    dimensionScores: [
      {
        dimensionId: DIMENSION_IDS.COHESION,
        score: 2,
        justification: 'ParkingLot allocates spots and processes payments.',
      },
    ],
    strengths: ['Vehicle types are modelled explicitly.'],
    feedback: [
      {
        dimensionId: DIMENSION_IDS.COHESION,
        severity: 'CRITICAL',
        category: 'COHESION',
        evidence: 'processPayment(Ticket t, Card c)',
        issue: 'ParkingLot owns both spot allocation and payment processing.',
        whyItMatters: 'Pricing rules and allocation rules change on different schedules.',
        suggestion: 'Move payment behind a PaymentProcessor collaborator.',
        principle: 'Single Responsibility Principle',
        pattern: null,
      },
    ],
    tradeOffs: [
      {
        decision: 'Holding the whole flow in ParkingLot.',
        upside: 'The end-to-end path is readable in one place.',
        downside: 'Every new rule edits the same class.',
      },
    ],
  };
}

describe('LlmEvaluationPayloadSchema', () => {
  it('accepts a well-formed payload', () => {
    const result = parseLlmEvaluationPayload(validPayload());

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.payload.dimensionScores[0]?.score).toBe(2);
      expect(result.payload.feedback[0]?.category).toBe('COHESION');
    }
  });

  it('rejects an overallScore, so the headline number stays derived', () => {
    // Assumption A2. The schema is strict rather than merely silent about this:
    // a model that returns 78 alongside scores of 2, 2, 3, 3 leaves the learner
    // with two numbers and no way to know which one is real.
    const result = parseLlmEvaluationPayload({ ...validPayload(), overallScore: 78 });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errorMessage).toMatch(/overallScore|unrecognized/i);
    }
  });

  it('rejects a comparison report, so improvement stays computed', () => {
    // Assumption A3.
    const result = parseLlmEvaluationPayload({
      ...validPayload(),
      comparison: { previousAttemptId: 'a1', overallDelta: 12 },
    });

    expect(result.ok).toBe(false);
  });

  it('rejects a score outside 0-5', () => {
    const payload = validPayload();
    (payload['dimensionScores'] as Array<Record<string, unknown>>)[0]!['score'] = 9;

    expect(parseLlmEvaluationPayload(payload).ok).toBe(false);
  });

  it('rejects a fractional score', () => {
    const payload = validPayload();
    (payload['dimensionScores'] as Array<Record<string, unknown>>)[0]!['score'] = 3.5;

    expect(parseLlmEvaluationPayload(payload).ok).toBe(false);
  });

  it('rejects feedback with no evidence', () => {
    const payload = validPayload();
    (payload['feedback'] as Array<Record<string, unknown>>)[0]!['evidence'] = '';

    const result = parseLlmEvaluationPayload(payload);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errorMessage).toContain('evidence');
    }
  });

  it('rejects a category outside the closed set', () => {
    const payload = validPayload();
    (payload['feedback'] as Array<Record<string, unknown>>)[0]!['category'] = 'VIBES';

    expect(parseLlmEvaluationPayload(payload).ok).toBe(false);
  });

  it('reports every problem at once, so one repair attempt can fix them all', () => {
    const result = parseLlmEvaluationPayload({
      dimensionScores: [],
      strengths: [],
      feedback: [],
      tradeOffs: [],
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errorMessage).toContain('dimensionScores');
    }
  });
});

describe('parseLlmEvaluationPayloadFromText', () => {
  it('accepts JSON wrapped in a markdown fence', () => {
    const text = '```json\n' + JSON.stringify(validPayload()) + '\n```';

    expect(parseLlmEvaluationPayloadFromText(text).ok).toBe(true);
  });

  it('accepts JSON preceded by conversational preamble', () => {
    const text = `Here is my evaluation:\n\n${JSON.stringify(validPayload())}`;

    expect(parseLlmEvaluationPayloadFromText(text).ok).toBe(true);
  });

  it('fails cleanly when there is no JSON at all', () => {
    const result = parseLlmEvaluationPayloadFromText('I could not evaluate this submission.');

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errorMessage).toContain('no JSON object');
    }
  });

  it('fails cleanly on genuinely malformed JSON', () => {
    const result = parseLlmEvaluationPayloadFromText('{ "dimensionScores": [ }');

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errorMessage).toContain('not valid JSON');
    }
  });
});
