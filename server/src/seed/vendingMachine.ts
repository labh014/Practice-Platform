import { ChangeScenario, Importance, Problem, Requirement } from '../domain';
import { buildRubric, DimensionMeta } from './rubricDimensions';

/**
 * Vending Machine - the second seeded problem.
 *
 * The PRD names two problems but specifies only Parking Lot, so this one is
 * authored to match its shape: five HIGH requirements, the same four weighted
 * dimensions, and one change scenario unlocking after the first attempt.
 *
 * It is chosen because it exercises a different design muscle. Parking Lot
 * rewards separating responsibilities that change on different schedules;
 * Vending Machine is fundamentally about state, and the mistake it invites is
 * a tangle of booleans standing in for a state machine. A learner who has done
 * both has practised two genuinely different LLD instincts rather than the same
 * one twice.
 *
 * Its change scenario probes payment abstraction the way EV charging probes
 * pricing - a new payment mechanism should be a new type, not another branch.
 */
export function buildVendingMachineProblem(): Problem {
  return new Problem({
    id: 'vending-machine',
    title: 'Vending Machine',
    summary:
      'Design the classes behind a vending machine: holding stock, taking payment, ' +
      'dispensing a product and returning change.',
    description: [
      'A vending machine holds several products, each with its own price and stock level.',
      'A customer inserts coins or notes, selects a product, and receives it along with',
      'any change owed. The machine must refuse a selection it cannot honour - out of',
      'stock, insufficient payment, or unable to make the correct change.',
      '',
      'Design the classes, interfaces and relationships behind this. Method bodies can be',
      'empty; what is being assessed is where you draw the boundaries and why.',
      '',
      'Pay particular attention to how the machine moves between situations: waiting,',
      'accepting money, dispensing, refunding. That movement is the heart of this problem.',
    ].join('\n'),

    requirements: [
      new Requirement({
        id: 'R1',
        text:
          'Hold multiple products, each with an independent price and stock level, ' +
          'addressable by a selection code.',
        importance: Importance.HIGH,
      }),
      new Requirement({
        id: 'R2',
        text:
          'Accept payment in coins and notes of several denominations, tracking the ' +
          'amount inserted so far in the current transaction.',
        importance: Importance.HIGH,
      }),
      new Requirement({
        id: 'R3',
        text:
          'Dispense the selected product only when it is in stock and the inserted ' +
          'amount covers its price.',
        importance: Importance.HIGH,
      }),
      new Requirement({
        id: 'R4',
        text:
          'Return the correct change from the denominations the machine holds, and ' +
          'refuse the sale if exact change cannot be made.',
        importance: Importance.HIGH,
      }),
      new Requirement({
        id: 'R5',
        text:
          'Model the machine as moving between distinct situations (idle, accepting ' +
          'payment, dispensing, refunding), with only the transitions that are legal ' +
          'from each one.',
        importance: Importance.HIGH,
      }),
    ],

    rubric: buildRubric({
      COHESION: {
        low:
          'One type holds inventory, payment, change calculation and state together, or ' +
          'the split does not follow any consistent reason to change.',
        mid:
          'Inventory or payment has been separated out, but the machine class still owns ' +
          'at least two independent jobs - typically change-making alongside transition ' +
          'control.',
        high:
          'Inventory, payment collection, change-making and state control are each owned ' +
          'by their own type, and the machine coordinates them rather than performing them.',
      },
      COUPLING: {
        low:
          'Everything is concrete, and payment or state behaviour is decided by inline ' +
          'conditionals on type flags.',
        mid:
          'An abstraction exists for one concern but another is still branched on inline, ' +
          'or an interface has been introduced where only one implementation will ever ' +
          'exist.',
        high:
          'Payment mechanisms and machine states are addressed through abstractions, and ' +
          'each one is justified by a variation the problem actually has.',
      },
      COMPLETENESS: {
        low: 'Two or more HIGH requirements have no representation in the design at all.',
        mid:
          'The happy path is modelled, but at least one refusal case is missing. Out of ' +
          'stock is usually handled; inability to make exact change is the one most often ' +
          'skipped.',
        high:
          'Every HIGH requirement has a home, including both refusal cases - out of stock ' +
          'and no exact change - and the assumptions field states which edge cases were ' +
          'deliberately excluded.',
      },
      EXTENSIBILITY: {
        low:
          'Adding a payment method or a new machine state would mean editing existing ' +
          'conditionals, and no trade-off is acknowledged.',
        mid:
          'One of the two axes extends cleanly while the other still requires edits to ' +
          'existing types.',
        high:
          'A new payment method and a new state are each additive, and the submission ' +
          'names the cost of the indirection it introduced as well as its benefit.',
      },
    }),

    changeScenario: new ChangeScenario({
      id: 'CS-1',
      title: 'Cashless payment',
      description: [
        'The operator wants to accept UPI and card payments alongside coins and notes.',
        'Cashless payments settle asynchronously - the machine must hold the product',
        'until confirmation arrives, and release the selection if it does not.',
        '',
        'Would your design absorb this by adding new types, or would you have to edit',
        'classes you have already written? Name the ones that would have to change.',
      ].join('\n'),
      unlocksAfterAttempt: 1,
      probesDimensionId: DimensionMeta.EXTENSIBILITY.id,
    }),
  });
}
