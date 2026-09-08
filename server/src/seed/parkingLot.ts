import { ChangeScenario, Importance, Problem, Requirement } from '../domain';
import { buildRubric, DimensionMeta } from './rubricDimensions';

/**
 * Parking Lot - the canonical LLD interview problem.
 *
 * Requirements, rubric weights and the change scenario are as specified in the
 * execution plan. The band text below is written specifically for this problem
 * rather than in the abstract, because "responsibilities are well separated" is
 * not a standard anyone can be held to, while "the lot coordinates allocation
 * and pricing rather than implementing them" is.
 */
export function buildParkingLotProblem(): Problem {
  return new Problem({
    id: 'parking-lot',
    title: 'Parking Lot',
    summary:
      'Design the classes behind a multi-level parking lot: admitting vehicles, ' +
      'assigning spots, issuing tickets and charging on exit.',
    description: [
      'A parking lot operates across several floors. Vehicles of different sizes arrive,',
      'are assigned a spot they physically fit in, and receive a ticket. On exit the',
      'ticket is presented and a fee is charged based on how long the vehicle stayed.',
      '',
      'Design the classes, interfaces and relationships behind this. You are not being',
      'asked for working code - method bodies can be empty. What is being assessed is',
      'where you draw the boundaries and why.',
      '',
      'The operator expects the pricing rules and the spot allocation policy to change',
      'over time, independently of each other.',
    ].join('\n'),

    requirements: [
      new Requirement({
        id: 'R1',
        text:
          'Support multiple vehicle types (for example motorcycle, car, truck), where ' +
          'the type determines which spots the vehicle can occupy.',
        importance: Importance.HIGH,
      }),
      new Requirement({
        id: 'R2',
        text:
          'Assign an arriving vehicle to a suitable available spot, with the assignment ' +
          'policy expressed as something that could later be changed.',
        importance: Importance.HIGH,
      }),
      new Requirement({
        id: 'R3',
        text:
          'Issue a ticket on entry that records enough to identify the vehicle, its spot ' +
          'and its entry time.',
        importance: Importance.HIGH,
      }),
      new Requirement({
        id: 'R4',
        text:
          'Calculate a fee on exit from the ticket, where the rate depends on duration ' +
          'and may depend on vehicle or spot type.',
        importance: Importance.HIGH,
      }),
      new Requirement({
        id: 'R5',
        text:
          'Allow a new allocation policy or a new pricing rule to be introduced without ' +
          'modifying the classes that already exist.',
        importance: Importance.HIGH,
      }),
    ],

    rubric: buildRubric({
      COHESION: {
        low:
          'A single type holds allocation, ticketing and pricing together, or ' +
          'responsibilities are split arbitrarily rather than by reason to change.',
        mid:
          'Some responsibilities are separated, but at least one type still owns two ' +
          'jobs that change independently - most commonly the lot itself both assigning ' +
          'spots and computing fees.',
        high:
          'Each type has one reason to change. Allocation, ticketing and pricing are ' +
          'owned by distinct collaborators, and ParkingLot coordinates them rather than ' +
          'implementing them.',
      },
      COUPLING: {
        low:
          'Every dependency is on a concrete type. There is no seam anywhere the ' +
          'behaviour is expected to vary.',
        mid:
          'An abstraction exists but is incompletely applied - an interface for pricing ' +
          'alongside a hard-coded rate elsewhere, or an abstraction introduced where ' +
          'nothing actually varies.',
        high:
          'Dependencies point at abstractions exactly where behaviour varies and nowhere ' +
          'else. Each interface is justified by a named axis of change rather than added ' +
          'to look thorough.',
      },
      COMPLETENESS: {
        low: 'Two or more HIGH requirements have no representation in the design at all.',
        mid:
          'The entry-to-exit flow is covered, but at least one HIGH requirement is missing ' +
          'or only implied. Vehicle-type-driven spot compatibility and rate variation are ' +
          'the usual omissions.',
        high:
          'Every HIGH requirement has an identifiable home in the design, and the ' +
          'assumptions field states what was deliberately excluded rather than leaving it ' +
          'silently absent.',
      },
      EXTENSIBILITY: {
        low:
          'A new pricing rule or allocation policy would mean editing existing classes, ' +
          'and no trade-off is acknowledged.',
        mid:
          'One axis of change is handled cleanly but the other still requires edits, or ' +
          'the trade-offs are asserted without naming what they cost.',
        high:
          'Both pricing and allocation can be extended by adding a type rather than ' +
          'editing one, and the submission names what its structure costs as well as what ' +
          'it buys.',
      },
    }),

    changeScenario: new ChangeScenario({
      id: 'CS-1',
      title: 'EV charging spots',
      description: [
        'The lot is adding EV charging spots. A vehicle parked in one is charged for its',
        'parking duration AND for the electricity it consumed while connected.',
        '',
        'Would your design absorb this by adding new types, or would you have to edit',
        'classes you have already written? Name the ones that would have to change.',
      ].join('\n'),
      unlocksAfterAttempt: 1,
      probesDimensionId: DimensionMeta.EXTENSIBILITY.id,
    }),
  });
}
