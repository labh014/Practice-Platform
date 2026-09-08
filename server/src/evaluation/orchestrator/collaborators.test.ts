import { describe, expect, it } from 'vitest';

import {
  DimensionScore,
  EvaluationResult,
  FeedbackCategory,
  FeedbackItem,
  InvalidScoreError,
  Severity,
} from '../../domain';
import {
  buildTestProblem,
  buildTestRubric,
  DIMENSION_IDS,
  godClassSubmission,
} from '../../testing/fixtures';
import { ComparisonReportBuilder } from './ComparisonReportBuilder';
import { EvidenceVerifier } from './EvidenceVerifier';
import { WeightedScoreCalculator } from './WeightedScoreCalculator';

function feedbackItem(overrides: {
  id?: string;
  dimensionId?: string;
  severity?: Severity;
  category?: FeedbackCategory;
  evidence?: string;
}): FeedbackItem {
  return new FeedbackItem({
    id: overrides.id ?? 'fb-1',
    dimensionId: overrides.dimensionId ?? DIMENSION_IDS.COHESION,
    severity: overrides.severity ?? Severity.CRITICAL,
    category: overrides.category ?? FeedbackCategory.COHESION,
    evidence: overrides.evidence ?? 'processPayment(Ticket t, Card c)',
    issue: 'ParkingLot owns payment processing.',
    whyItMatters: 'Pricing and allocation change independently.',
    suggestion: 'Extract a PaymentProcessor.',
  });
}

describe('EvidenceVerifier', () => {
  const verifier = new EvidenceVerifier();
  const submission = godClassSubmission();

  it('keeps feedback quoting text the learner actually wrote', () => {
    const { kept, discarded } = verifier.verify(
      [feedbackItem({ evidence: 'processPayment(Ticket t, Card c)' })],
      submission,
    );

    expect(kept).toHaveLength(1);
    expect(discarded).toHaveLength(0);
  });

  it('discards feedback quoting a class the learner never wrote', () => {
    // The failure this exists to catch. One critique of an invented
    // BookingService and the learner has reason to distrust every other finding.
    const { kept, discarded } = verifier.verify(
      [feedbackItem({ evidence: 'class BookingService { reserve() {} }' })],
      submission,
    );

    expect(kept).toHaveLength(0);
    expect(discarded).toHaveLength(1);
  });

  it('tolerates reformatting, since presentation is not the failure mode', () => {
    const { kept } = verifier.verify(
      [feedbackItem({ evidence: '  processPayment(Ticket   t,  Card c)  ' })],
      submission,
    );

    expect(kept).toHaveLength(1);
  });

  it('tolerates a snippet wrapped in backticks or quotes', () => {
    const { kept } = verifier.verify(
      [feedbackItem({ evidence: '`calculateFee(Ticket t) { }`' })],
      submission,
    );

    expect(kept).toHaveLength(1);
  });

  it('ignores case differences', () => {
    const { kept } = verifier.verify(
      [feedbackItem({ evidence: 'CLASS PARKINGLOT {' })],
      submission,
    );

    expect(kept).toHaveLength(1);
  });

  it('finds evidence in the design decisions field, not just the skeleton', () => {
    const { kept } = verifier.verify(
      [feedbackItem({ evidence: 'I kept everything in ParkingLot' })],
      submission,
    );

    expect(kept).toHaveLength(1);
  });

  it('partitions a mixed batch', () => {
    const { kept, discarded } = verifier.verify(
      [
        feedbackItem({ id: 'real', evidence: 'assignSpot(Vehicle v) { }' }),
        feedbackItem({ id: 'invented', evidence: 'ElevatorController.dispatch()' }),
      ],
      submission,
    );

    expect(kept.map((item) => item.id)).toEqual(['real']);
    expect(discarded.map((item) => item.id)).toEqual(['invented']);
  });
});

describe('WeightedScoreCalculator', () => {
  const calculator = new WeightedScoreCalculator();
  const rubric = buildTestRubric();

  function scores(values: [number, number, number, number]): DimensionScore[] {
    const ids = [
      DIMENSION_IDS.COHESION,
      DIMENSION_IDS.COUPLING,
      DIMENSION_IDS.COMPLETENESS,
      DIMENSION_IDS.EXTENSIBILITY,
    ];

    return ids.map(
      (dimensionId, index) =>
        new DimensionScore({
          dimensionId,
          score: values[index] ?? 0,
          justification: 'Because.',
        }),
    );
  }

  it('applies rubric weights to produce a 0-100 score', () => {
    // 4/5 at 25% each = 0.8 * 100 = 80
    expect(calculator.calculate(scores([4, 4, 4, 4]), rubric)).toBe(80);
  });

  it('weights each dimension equally when the rubric says so', () => {
    // (2 + 2 + 3 + 3) / 20 = 0.5 -> 50
    expect(calculator.calculate(scores([2, 2, 3, 3]), rubric)).toBe(50);
  });

  it('returns 0 for a submission that scored nothing', () => {
    expect(calculator.calculate(scores([0, 0, 0, 0]), rubric)).toBe(0);
  });

  it('returns 100 only for full marks across the rubric', () => {
    expect(calculator.calculate(scores([5, 5, 5, 5]), rubric)).toBe(100);
  });

  it('refuses to score a partial rubric rather than understating the design', () => {
    const partial = scores([4, 4, 4, 4]).slice(0, 2);

    expect(() => calculator.calculate(partial, rubric)).toThrow(InvalidScoreError);
  });
});

describe('ComparisonReportBuilder', () => {
  const builder = new ComparisonReportBuilder();
  const problem = buildTestProblem();
  const rubric = problem.rubric;

  function resultWith(params: {
    overallScore: number;
    values: [number, number, number, number];
    feedback?: FeedbackItem[];
  }): EvaluationResult {
    const ids = [
      DIMENSION_IDS.COHESION,
      DIMENSION_IDS.COUPLING,
      DIMENSION_IDS.COMPLETENESS,
      DIMENSION_IDS.EXTENSIBILITY,
    ];

    return new EvaluationResult({
      overallScore: params.overallScore,
      dimensionScores: ids.map(
        (dimensionId, index) =>
          new DimensionScore({
            dimensionId,
            score: params.values[index] ?? 0,
            justification: 'Because.',
          }),
      ),
      strengths: [],
      feedback: params.feedback ?? [],
      tradeOffs: [],
      evaluatorModel: 'mock',
    });
  }

  it('computes a per-dimension delta from stored scores', () => {
    const report = builder.build({
      previous: {
        attemptId: 'a1',
        attemptNumber: 1,
        result: resultWith({ overallScore: 40, values: [1, 2, 2, 3] }),
        changeScenarioDimensionId: null,
      },
      currentDimensionScores: resultWith({ overallScore: 65, values: [4, 3, 2, 3] })
        .dimensionScores,
      currentOverallScore: 65,
      currentFeedback: [],
      rubric,
      currentChangeScenarioDimensionId: null,
    });

    const cohesion = report.dimensionDeltas.find(
      (delta) => delta.dimensionId === DIMENSION_IDS.COHESION,
    );

    expect(cohesion?.delta).toBe(3);
    expect(cohesion?.direction).toBe('IMPROVED');
    expect(report.overallDelta).toBe(25);
    expect(report.hasImproved).toBe(true);
  });

  it('marks a dimension as scope-changed when the change scenario first applies', () => {
    // Assumption A1. Extensibility is judged against a harder question from
    // attempt 2, so a flat score there is not evidence the design got worse.
    const report = builder.build({
      previous: {
        attemptId: 'a1',
        attemptNumber: 1,
        result: resultWith({ overallScore: 60, values: [3, 3, 3, 3] }),
        changeScenarioDimensionId: null,
      },
      currentDimensionScores: resultWith({ overallScore: 55, values: [4, 3, 3, 2] })
        .dimensionScores,
      currentOverallScore: 55,
      currentFeedback: [],
      rubric,
      currentChangeScenarioDimensionId: DIMENSION_IDS.EXTENSIBILITY,
    });

    const extensibility = report.dimensionDeltas.find(
      (delta) => delta.dimensionId === DIMENSION_IDS.EXTENSIBILITY,
    );

    expect(extensibility?.scopeChanged).toBe(true);
    expect(extensibility?.delta).toBe(-1);
    // The drop is excluded from genuine regressions, so the UI does not show a
    // red arrow for a goalpost the learner did not move.
    expect(report.regressedDeltas).toHaveLength(0);
  });

  it('does not mark scope as changed when the scenario applied to both attempts', () => {
    const report = builder.build({
      previous: {
        attemptId: 'a2',
        attemptNumber: 2,
        result: resultWith({ overallScore: 55, values: [3, 3, 3, 2] }),
        changeScenarioDimensionId: DIMENSION_IDS.EXTENSIBILITY,
      },
      currentDimensionScores: resultWith({ overallScore: 50, values: [3, 3, 3, 1] })
        .dimensionScores,
      currentOverallScore: 50,
      currentFeedback: [],
      rubric,
      currentChangeScenarioDimensionId: DIMENSION_IDS.EXTENSIBILITY,
    });

    const extensibility = report.dimensionDeltas.find(
      (delta) => delta.dimensionId === DIMENSION_IDS.EXTENSIBILITY,
    );

    expect(extensibility?.scopeChanged).toBe(false);
    expect(report.regressedDeltas).toHaveLength(1);
  });

  it('reports an issue category as resolved when it no longer appears', () => {
    const previousFeedback = [
      feedbackItem({ id: 'p1', category: FeedbackCategory.COHESION }),
      feedbackItem({
        id: 'p2',
        dimensionId: DIMENSION_IDS.COUPLING,
        category: FeedbackCategory.COUPLING,
      }),
    ];

    const report = builder.build({
      previous: {
        attemptId: 'a1',
        attemptNumber: 1,
        result: resultWith({ overallScore: 40, values: [1, 1, 3, 3], feedback: previousFeedback }),
        changeScenarioDimensionId: null,
      },
      currentDimensionScores: resultWith({ overallScore: 70, values: [4, 1, 3, 3] })
        .dimensionScores,
      currentOverallScore: 70,
      currentFeedback: [
        feedbackItem({
          id: 'c1',
          dimensionId: DIMENSION_IDS.COUPLING,
          category: FeedbackCategory.COUPLING,
        }),
      ],
      rubric,
      currentChangeScenarioDimensionId: null,
    });

    expect(report.resolvedCategories).toContain(FeedbackCategory.COHESION);
    expect(report.persistingCategories).toContain(FeedbackCategory.COUPLING);
    expect(report.resolvedDimensionIds).toContain(DIMENSION_IDS.COHESION);
    expect(report.persistingDimensionIds).toContain(DIMENSION_IDS.COUPLING);
  });

  it('treats a MINOR issue as not blocking, so it never counts as unresolved', () => {
    const report = builder.build({
      previous: {
        attemptId: 'a1',
        attemptNumber: 1,
        result: resultWith({
          overallScore: 60,
          values: [3, 3, 3, 3],
          feedback: [feedbackItem({ id: 'p1', severity: Severity.MINOR })],
        }),
        changeScenarioDimensionId: null,
      },
      currentDimensionScores: resultWith({ overallScore: 60, values: [3, 3, 3, 3] })
        .dimensionScores,
      currentOverallScore: 60,
      currentFeedback: [],
      rubric,
      currentChangeScenarioDimensionId: null,
    });

    expect(report.resolvedDimensionIds).toHaveLength(0);
    expect(report.persistingDimensionIds).toHaveLength(0);
  });
});
