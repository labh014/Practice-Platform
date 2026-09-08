import {
  ChangeScenario,
  EvaluationDimension,
  EvaluationRubric,
  Importance,
  Problem,
  Requirement,
  ScoreBand,
  Submission,
} from '../domain';

/**
 * Test fixtures.
 *
 * A trimmed stand-in for the seeded content of Phase 4, kept separate so unit
 * tests stay independent of the real problem catalogue. A test that breaks
 * because a seed file was reworded is a test that has stopped being about the
 * behaviour it names.
 */

export const DIMENSION_IDS = {
  COHESION: 'responsibility-cohesion',
  COUPLING: 'coupling-abstraction',
  COMPLETENESS: 'requirement-completeness',
  EXTENSIBILITY: 'extensibility-tradeoffs',
} as const;

function threeBands(subject: string): ScoreBand[] {
  return [
    new ScoreBand({
      minScore: 0,
      maxScore: 1,
      descriptor: `${subject} is absent or fundamentally misapplied.`,
    }),
    new ScoreBand({
      minScore: 2,
      maxScore: 3,
      descriptor: `${subject} is attempted but inconsistent.`,
    }),
    new ScoreBand({
      minScore: 4,
      maxScore: 5,
      descriptor: `${subject} is deliberate and well justified.`,
    }),
  ];
}

export function buildTestRubric(): EvaluationRubric {
  return new EvaluationRubric([
    new EvaluationDimension({
      id: DIMENSION_IDS.COHESION,
      name: 'Responsibility & Cohesion',
      description: 'Whether each type has one reason to change.',
      weight: 25,
      bands: threeBands('Responsibility separation'),
    }),
    new EvaluationDimension({
      id: DIMENSION_IDS.COUPLING,
      name: 'Coupling & Abstraction Quality',
      description: 'Whether dependencies point at abstractions.',
      weight: 25,
      bands: threeBands('Abstraction quality'),
    }),
    new EvaluationDimension({
      id: DIMENSION_IDS.COMPLETENESS,
      name: 'Requirement Completeness',
      description: 'Whether the stated requirements are addressed.',
      weight: 25,
      bands: threeBands('Requirement coverage'),
    }),
    new EvaluationDimension({
      id: DIMENSION_IDS.EXTENSIBILITY,
      name: 'Extensibility & Trade-offs',
      description: 'Whether the design absorbs change without edits.',
      weight: 25,
      bands: threeBands('Extensibility'),
    }),
  ]);
}

export function buildTestProblem(options?: { withChangeScenario?: boolean }): Problem {
  const withChangeScenario = options?.withChangeScenario ?? true;

  return new Problem({
    id: 'parking-lot',
    title: 'Parking Lot',
    summary: 'Design the classes behind a multi-level parking lot.',
    description:
      'Design the classes behind a multi-level parking lot that admits several ' +
      'vehicle types, assigns spots, issues tickets and charges on exit.',
    requirements: [
      new Requirement({
        id: 'R1',
        text: 'Support multiple vehicle types.',
        importance: Importance.HIGH,
      }),
      new Requirement({
        id: 'R2',
        text: 'Assign a spot to an arriving vehicle.',
        importance: Importance.HIGH,
      }),
      new Requirement({
        id: 'R3',
        text: 'Issue a ticket on entry.',
        importance: Importance.HIGH,
      }),
      new Requirement({
        id: 'R4',
        text: 'Calculate a fee on exit.',
        importance: Importance.HIGH,
      }),
    ],
    rubric: buildTestRubric(),
    changeScenario: withChangeScenario
      ? new ChangeScenario({
          id: 'CS-1',
          title: 'EV charging spots',
          description:
            'The lot introduces EV charging spots. The fee must combine parking ' +
            'duration with electricity consumed.',
          unlocksAfterAttempt: 1,
          probesDimensionId: DIMENSION_IDS.EXTENSIBILITY,
        })
      : null,
  });
}

/** A submission with the God-class shape: one type doing allocation and payment. */
export function godClassSubmission(): Submission {
  return Submission.create({
    designSkeleton: [
      'class ParkingLot {',
      '  List<Spot> spots;',
      '  assignSpot(Vehicle v) { }',
      '  calculateFee(Ticket t) { }',
      '  processPayment(Ticket t, Card c) { }',
      '  issueTicket(Vehicle v) { }',
      '}',
    ].join('\n'),
    designDecisions:
      'I kept everything in ParkingLot so the flow is easy to follow end to end ' +
      'without jumping between files.',
    assumptions: 'Assumed a single physical lot and card payment only.',
  });
}

/** A submission with separated responsibilities and an abstraction for pricing. */
export function wellSeparatedSubmission(): Submission {
  return Submission.create({
    designSkeleton: [
      'interface FeeStrategy {',
      '  Money feeFor(Ticket ticket);',
      '}',
      '',
      'class HourlyFeeStrategy implements FeeStrategy {',
      '  Money feeFor(Ticket ticket) { }',
      '}',
      '',
      'class SpotAllocator {',
      '  Spot allocate(Vehicle vehicle);',
      '}',
      '',
      'class TicketService {',
      '  Ticket issue(Vehicle vehicle, Spot spot);',
      '}',
      '',
      'class ParkingLot {',
      '  Ticket admit(Vehicle vehicle);',
      '  Money exit(Ticket ticket);',
      '}',
    ].join('\n'),
    designDecisions:
      'Pricing sits behind FeeStrategy because the fee rules change on a different ' +
      'schedule from allocation. SpotAllocator is separate so a new allocation policy ' +
      'does not touch ParkingLot.',
    assumptions:
      'Assumed one lot, and that payment capture is handled by an external service ' +
      'outside this design.',
  });
}

export function emptySubmission(): Submission {
  return Submission.create({ designSkeleton: '', designDecisions: '', assumptions: '' });
}
