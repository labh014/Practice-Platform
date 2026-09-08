import { describe, expect, it } from 'vitest';

import {
  Attempt,
  AttemptStatus,
  ChangeScenario,
  DimensionScore,
  EvaluationDimension,
  EvaluationResult,
  EvaluationRubric,
  Importance,
  InvalidAttemptTransitionError,
  InvalidProblemError,
  InvalidRubricError,
  InvalidScoreError,
  Problem,
  Requirement,
  ScoreBand,
  Submission,
} from './index';

/** Three bands covering 0-5, the shape every seeded dimension uses. */
function bands(): ScoreBand[] {
  return [
    new ScoreBand({ minScore: 0, maxScore: 1, descriptor: 'Absent or fundamentally wrong.' }),
    new ScoreBand({ minScore: 2, maxScore: 3, descriptor: 'Present but inconsistent.' }),
    new ScoreBand({ minScore: 4, maxScore: 5, descriptor: 'Deliberate and well justified.' }),
  ];
}

function dimension(id: string, weight: number): EvaluationDimension {
  return new EvaluationDimension({
    id,
    name: id,
    description: `Judges ${id}.`,
    weight,
    bands: bands(),
  });
}

function submission(): Submission {
  return Submission.create({
    designSkeleton: 'class ParkingLot { assignSpot() {} }',
    designDecisions: 'Chose a single allocator to keep assignment logic in one place.',
    assumptions: 'Assumed a single physical lot.',
  });
}

describe('EvaluationRubric', () => {
  it('rejects weights that do not sum to 100', () => {
    expect(() => new EvaluationRubric([dimension('cohesion', 25), dimension('coupling', 25)]))
      .toThrow(InvalidRubricError);
  });

  it('accepts weights summing to 100', () => {
    const rubric = new EvaluationRubric([
      dimension('cohesion', 25),
      dimension('coupling', 25),
      dimension('completeness', 25),
      dimension('extensibility', 25),
    ]);

    expect(rubric.dimensionIds).toHaveLength(4);
    expect(rubric.get('coupling').weight).toBe(25);
  });

  it('rejects duplicate dimension ids', () => {
    expect(
      () => new EvaluationRubric([dimension('cohesion', 50), dimension('cohesion', 50)]),
    ).toThrow(InvalidRubricError);
  });
});

describe('EvaluationDimension score bands', () => {
  it('rejects bands that leave a gap in the 0-5 scale', () => {
    expect(
      () =>
        new EvaluationDimension({
          id: 'cohesion',
          name: 'Cohesion',
          description: 'Judges cohesion.',
          weight: 100,
          bands: [
            new ScoreBand({ minScore: 0, maxScore: 1, descriptor: 'Weak.' }),
            // 2 is missing, so a score of 2 could not be described back.
            new ScoreBand({ minScore: 3, maxScore: 5, descriptor: 'Strong.' }),
          ],
        }),
    ).toThrow(InvalidRubricError);
  });

  it('maps a score to the band that describes it', () => {
    expect(dimension('cohesion', 100).bandFor(2).descriptor).toBe('Present but inconsistent.');
  });
});

describe('Problem and ChangeScenario', () => {
  const rubric = new EvaluationRubric([
    dimension('cohesion', 25),
    dimension('coupling', 25),
    dimension('completeness', 25),
    dimension('extensibility', 25),
  ]);

  function buildProblem(scenario?: ChangeScenario): Problem {
    return new Problem({
      id: 'parking-lot',
      title: 'Parking Lot',
      summary: 'Design a parking lot.',
      description: 'Design the classes for a multi-level parking lot.',
      requirements: [
        new Requirement({ id: 'R1', text: 'Support multiple vehicle types', importance: Importance.HIGH }),
      ],
      rubric,
      changeScenario: scenario ?? null,
    });
  }

  it('rejects a change scenario probing an unknown dimension', () => {
    const scenario = new ChangeScenario({
      id: 'CS-1',
      title: 'EV charging',
      description: 'Add EV charging spots.',
      unlocksAfterAttempt: 1,
      probesDimensionId: 'not-a-dimension',
    });

    expect(() => buildProblem(scenario)).toThrow(InvalidProblemError);
  });

  it('activates the change scenario only from attempt 2 onward', () => {
    const problem = buildProblem(
      new ChangeScenario({
        id: 'CS-1',
        title: 'EV charging',
        description: 'Add EV charging spots.',
        unlocksAfterAttempt: 1,
        probesDimensionId: 'extensibility',
      }),
    );

    expect(problem.activeChangeScenarioFor(1)).toBeNull();
    expect(problem.activeChangeScenarioFor(2)?.id).toBe('CS-1');
  });
});

describe('Attempt state machine', () => {
  function newAttempt(): Attempt {
    return new Attempt({
      id: 'a1',
      problemId: 'parking-lot',
      userId: 'learner_1',
      attemptNumber: 1,
      submission: submission(),
    });
  }

  it('starts as SUBMITTED', () => {
    expect(newAttempt().status).toBe(AttemptStatus.SUBMITTED);
  });

  it('refuses to complete an attempt that never started evaluating', () => {
    const attempt = newAttempt();
    expect(() => attempt.failWith('boom')).toThrow(InvalidAttemptTransitionError);
  });

  it('allows a FAILED attempt to be retried, keeping the submission intact', () => {
    const attempt = newAttempt();
    attempt.beginEvaluation();
    attempt.failWith('LLM returned malformed JSON');

    expect(attempt.status).toBe(AttemptStatus.FAILED);
    expect(attempt.isRetryable).toBe(true);
    expect(attempt.submission.designSkeleton).toContain('ParkingLot');

    attempt.beginEvaluation();

    expect(attempt.status).toBe(AttemptStatus.EVALUATING);
    expect(attempt.failureReason).toBeNull();
    expect(attempt.evaluationRuns).toBe(2);
  });

  it('refuses to start a second evaluation while one is already running', () => {
    const attempt = newAttempt();
    attempt.beginEvaluation();

    expect(() => attempt.beginEvaluation()).toThrow(InvalidAttemptTransitionError);
  });

  it('treats COMPLETED as terminal, so a revision must become a new attempt', () => {
    const attempt = newAttempt();
    attempt.beginEvaluation();
    attempt.completeWith(
      new EvaluationResult({
        overallScore: 60,
        dimensionScores: [
          new DimensionScore({
            dimensionId: 'cohesion',
            score: 3,
            justification: 'ParkingLot holds both allocation and pricing.',
          }),
        ],
        strengths: ['Clear vehicle type modelling.'],
        feedback: [],
        tradeOffs: [],
        evaluatorModel: 'mock',
      }),
    );

    expect(attempt.status).toBe(AttemptStatus.COMPLETED);
    expect(() => attempt.beginEvaluation()).toThrow(InvalidAttemptTransitionError);
  });
});

describe('DimensionScore', () => {
  it('rejects a score outside 0-5', () => {
    expect(
      () => new DimensionScore({ dimensionId: 'cohesion', score: 7, justification: 'x' }),
    ).toThrow(InvalidScoreError);
  });

  it('rejects an unexplained score', () => {
    expect(
      () => new DimensionScore({ dimensionId: 'cohesion', score: 3, justification: '  ' }),
    ).toThrow(InvalidScoreError);
  });
});

describe('Submission', () => {
  it('accepts an empty submission so it can be evaluated rather than rejected', () => {
    const empty = Submission.create({
      designSkeleton: '',
      designDecisions: '',
      assumptions: '',
    });

    expect(empty.isEmpty()).toBe(true);
    expect(empty.hasDesignSkeleton()).toBe(false);
  });

  it('exposes all three fields as one searchable body for evidence verification', () => {
    const combined = submission().combinedText;

    expect(combined).toContain('ParkingLot');
    expect(combined).toContain('single allocator');
  });
});
