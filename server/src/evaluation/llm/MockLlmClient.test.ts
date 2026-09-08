import { describe, expect, it } from 'vitest';

import { FeedbackCategory, Severity, type Submission } from '../../domain';
import { buildVendingMachineProblem } from '../../seed/vendingMachine';
import {
  booleanStateVendingMachine,
  buildTestProblem,
  DIMENSION_IDS,
  emptySubmission,
  godClassSubmission,
  wellSeparatedSubmission,
} from '../../testing/fixtures';
import { EvaluationContext } from '../evaluators/EvaluationContext';
import { EvidenceVerifier } from '../orchestrator/EvidenceVerifier';
import { EvaluationPromptBuilder } from '../prompt/EvaluationPromptBuilder';
import { parseLlmEvaluationPayloadFromText } from '../schema/LlmEvaluationPayloadSchema';
import { MockLlmClient } from './MockLlmClient';

const client = new MockLlmClient();
const promptBuilder = new EvaluationPromptBuilder();

function payloadFor(submission: Submission, attemptNumber = 1) {
  const context = new EvaluationContext({
    problem: buildTestProblem(),
    submission,
    attemptNumber,
  });
  return client.buildPayload(promptBuilder.build(context));
}

function scoreOf(
  payload: ReturnType<typeof payloadFor>,
  dimensionId: string,
): number | undefined {
  return payload.dimensionScores.find((score) => score.dimensionId === dimensionId)?.score;
}

describe('MockLlmClient', () => {
  it('reacts to the submission rather than returning a canned response', () => {
    const godClass = payloadFor(godClassSubmission());
    const separated = payloadFor(wellSeparatedSubmission());

    // If these matched, every downstream test would pass without proving anything.
    expect(godClass.feedback).not.toEqual(separated.feedback);
    expect(scoreOf(godClass, DIMENSION_IDS.COHESION)).toBeLessThan(
      scoreOf(separated, DIMENSION_IDS.COHESION) ?? 0,
    );
  });

  it('identifies a God class and attributes it to the cohesion dimension', () => {
    const payload = payloadFor(godClassSubmission());
    const cohesionIssue = payload.feedback.find(
      (item) => item.category === FeedbackCategory.COHESION,
    );

    expect(cohesionIssue).toBeDefined();
    expect(cohesionIssue?.severity).toBe(Severity.CRITICAL);
    expect(cohesionIssue?.dimensionId).toBe(DIMENSION_IDS.COHESION);
    expect(cohesionIssue?.principle).toBe('Single Responsibility Principle');
    expect(cohesionIssue?.issue).toContain('ParkingLot');
  });

  it('flags hard-wired pricing and names the pattern that would fix it', () => {
    const payload = payloadFor(godClassSubmission());
    const extensibility = payload.feedback.find(
      (item) => item.dimensionId === DIMENSION_IDS.EXTENSIBILITY,
    );

    expect(extensibility?.pattern).toBe('Strategy');
    expect(extensibility?.evidence).toContain('calculateFee');
  });

  it('does not raise the pricing issue once pricing sits behind an abstraction', () => {
    const payload = payloadFor(wellSeparatedSubmission());

    expect(
      payload.feedback.some((item) => item.category === FeedbackCategory.EXTENSIBILITY),
    ).toBe(false);
  });

  it('quotes evidence that survives the verifier', () => {
    // Self-consistency check. A mock that invented snippets would have all of
    // its feedback silently discarded by EvidenceVerifier, and no other test
    // would catch it.
    const submission = godClassSubmission();
    const payload = payloadFor(submission);
    const haystack = submission.combinedText.replace(/\s+/g, ' ').toLowerCase();

    for (const item of payload.feedback) {
      expect(haystack).toContain(item.evidence.replace(/\s+/g, ' ').toLowerCase());
    }
  });

  it('scores an empty submission at zero across every dimension', () => {
    const payload = payloadFor(emptySubmission());

    expect(payload.dimensionScores.every((score) => score.score === 0)).toBe(true);
    expect(payload.strengths).toHaveLength(0);
    expect(payload.feedback[0]?.severity).toBe(Severity.CRITICAL);
  });

  it('credits only strengths a weak submission genuinely has', () => {
    // The God class does cover all three flows and does state its scope, so
    // saying so is accurate rather than consoling. What it must not receive is
    // credit for the abstraction it does not have - and the praise must not
    // soften the score.
    const payload = payloadFor(godClassSubmission());

    expect(payload.strengths.join(' ')).not.toMatch(/interface|abstraction|decomposed/i);
    expect(scoreOf(payload, DIMENSION_IDS.COHESION)).toBeLessThanOrEqual(1);
  });

  it('credits genuine strengths on a strong submission', () => {
    const payload = payloadFor(wellSeparatedSubmission());

    expect(payload.strengths.length).toBeGreaterThan(0);
    expect(payload.strengths.join(' ')).toMatch(/interface|decomposed/i);
  });

  it('withholds top marks even from a clean submission', () => {
    // Heuristic rules are not thorough enough to justify a 5. Grade inflation
    // from the offline evaluator would be the worst available outcome, since it
    // is the one most learners will see.
    const payload = payloadFor(wellSeparatedSubmission());

    expect(payload.dimensionScores.every((score) => score.score <= 4)).toBe(true);
  });

  it('acknowledges a trade-off rather than treating every choice as a mistake', () => {
    const payload = payloadFor(godClassSubmission());

    expect(payload.tradeOffs).toHaveLength(1);
    expect(payload.tradeOffs[0]?.upside).toBeTruthy();
    expect(payload.tradeOffs[0]?.downside).toBeTruthy();
  });

  it('emits JSON that satisfies the strict schema', async () => {
    const context = new EvaluationContext({
      problem: buildTestProblem(),
      submission: godClassSubmission(),
      attemptNumber: 1,
    });

    const raw = await client.complete(promptBuilder.build(context));

    expect(parseLlmEvaluationPayloadFromText(raw).ok).toBe(true);
  });

  it('has something to say about the vending machine, not just the parking lot', () => {
    // Regression guard. The first version of these rules only knew about
    // vehicles, spots and fees, so a God-class vending machine with boolean
    // state flags - the canonical mistake for that problem - drew 60/100 and
    // zero findings. A seeded problem the default evaluator is silent on is a
    // broken demo, not a lenient one.
    const context = new EvaluationContext({
      problem: buildVendingMachineProblem(),
      submission: booleanStateVendingMachine(),
      attemptNumber: 1,
    });

    const payload = client.buildPayload(promptBuilder.build(context));

    expect(payload.feedback.length).toBeGreaterThan(0);
    expect(payload.dimensionScores.every((score) => score.score <= 3)).toBe(true);
  });

  it('names the State pattern when booleans stand in for a state machine', () => {
    const context = new EvaluationContext({
      problem: buildVendingMachineProblem(),
      submission: booleanStateVendingMachine(),
      attemptNumber: 1,
    });

    const payload = client.buildPayload(promptBuilder.build(context));
    const stateIssue = payload.feedback.find((item) => item.pattern === 'State');

    expect(stateIssue).toBeDefined();
    expect(stateIssue?.evidence).toMatch(/boolean|isDispensing/i);
    expect(stateIssue?.whyItMatters).toMatch(/combination|multiply/i);
  });

  it('scores every dimension the rubric defines, exactly once', () => {
    const payload = payloadFor(godClassSubmission());
    const ids = payload.dimensionScores.map((score) => score.dimensionId);

    expect(new Set(ids).size).toBe(4);
    expect(ids).toEqual(expect.arrayContaining(Object.values(DIMENSION_IDS)));
  });
});

describe('MockLlmClient evidence against the verifier', () => {
  it('keeps all of its feedback when run through EvidenceVerifier', () => {
    const submission = godClassSubmission();
    const payload = payloadFor(submission);

    const verifier = new EvidenceVerifier();
    const asItems = payload.feedback.map((item, index) => ({
      ...item,
      id: `fb-${index}`,
    }));

    const { discarded } = verifier.verify(asItems as never, submission);

    expect(discarded).toHaveLength(0);
  });
});
