import { ChangeScenario, Importance, Problem, Requirement } from '../domain';
import { buildRubric, DimensionMeta } from './rubricDimensions';

/**
 * Splitwise (Expense Splitter) - a data-modelling and strategy problem.
 *
 * The design instinct here is different from either seeded problem. There is
 * essentially no state machine and the extension axis is not policy over time -
 * it is how a single bill is divided across users, and how balances are
 * derived from those splits. The classic mistake is a single `Expense` that
 * carries every split kind as optional fields.
 */
export function buildSplitwiseProblem(): Problem {
  return new Problem({
    id: 'splitwise',
    title: 'Splitwise',
    summary:
      'Design the classes behind a group expense tracker: recording who paid, ' +
      'dividing the bill by different rules, and computing what each user owes.',
    description: [
      'A group of users share expenses. When one member pays, the bill is divided among',
      'some subset of members using one of several rules: equal split, exact amounts,',
      'or percentages that must sum to 100. Adding an expense updates each involved',
      "member's balance. At any point a user can see net balances - who owes whom.",
      '',
      'Design the classes, interfaces and relationships behind this. Method bodies can be',
      'empty; what is being assessed is how you model the different split rules, and how',
      "balances are derived from the recorded expenses rather than stored alongside them.",
      '',
      'The product owner expects new split rules to appear (share-based, quantity-based)',
      'without touching the expense recording or balance calculation code.',
    ].join('\n'),

    requirements: [
      new Requirement({
        id: 'R1',
        text:
          'Represent users and groups, where an expense is recorded against a group and ' +
          'involves some subset of its members.',
        importance: Importance.HIGH,
      }),
      new Requirement({
        id: 'R2',
        text:
          'Record an expense that names the payer, the total amount, and how it is ' +
          'divided among participating members using one of several split rules.',
        importance: Importance.HIGH,
      }),
      new Requirement({
        id: 'R3',
        text:
          'Support at least three split rules - equal, exact amounts, and percentages - ' +
          'each with its own validation (percentages sum to 100, exact amounts sum to the ' +
          'total).',
        importance: Importance.HIGH,
      }),
      new Requirement({
        id: 'R4',
        text:
          'Compute the net balance between any two users in a group by aggregating over ' +
          'the recorded expenses, rather than storing balances alongside them.',
        importance: Importance.HIGH,
      }),
      new Requirement({
        id: 'R5',
        text:
          'Allow a new split rule to be introduced without modifying the expense, group ' +
          'or balance-calculation classes that already exist.',
        importance: Importance.HIGH,
      }),
    ],

    rubric: buildRubric({
      COHESION: {
        low:
          'A single Expense type carries the rule kind, the amounts, the percentages and ' +
          "the participants together, or balance state is stored on the group and mutated " +
          'on every expense.',
        mid:
          'Split logic is separated from Expense, but balance is still stored on the ' +
          'group or on the user rather than derived - so a corrected expense means ' +
          'walking back a mutation.',
        high:
          'Splits, expenses and balance calculation are each owned by their own type. ' +
          'Balances are derived from the expense history rather than kept in sync with it.',
      },
      COUPLING: {
        low:
          'Every rule is a branch in one place. Rule kind is a string or enum switched on ' +
          'wherever the amount is used.',
        mid:
          'A split-rule abstraction exists but the balance calculator still switches on ' +
          'the rule kind, or one rule remains inlined alongside an interface for the ' +
          'others.',
        high:
          'Each split rule is one implementation of a common contract, and the balance ' +
          'calculator consumes only that contract. Adding a rule adds a type, not a ' +
          'branch.',
      },
      COMPLETENESS: {
        low: 'Two or more HIGH requirements have no representation in the design at all.',
        mid:
          'Expenses and one or two split rules are covered, but validation across rules ' +
          'is either missing or lumped into a general check rather than owned by each ' +
          'rule.',
        high:
          'All three split rules are represented, each with its own validation, and net ' +
          'balances are computed from expenses rather than tracked separately. The ' +
          'assumptions field states what was deliberately left out (currencies, ' +
          'settlements).',
      },
      EXTENSIBILITY: {
        low:
          'A new split rule would mean editing the expense class and the balance ' +
          'calculator, and no trade-off is acknowledged.',
        mid:
          'A new rule can be added but validation logic still lives outside the rule, so ' +
          'the change touches two places rather than one.',
        high:
          'A new split rule is a new type - it declares its own validation and its own ' +
          'per-user share calculation - and the submission names the cost of the ' +
          'indirection as well as its benefit.',
      },
    }),

    changeScenario: new ChangeScenario({
      id: 'CS-1',
      title: 'Simplify debts',
      description: [
        "Add a 'simplify debts' feature: given a group's balances, compute the minimum",
        'set of transactions that settle everyone up (A owes B, B owes C might collapse to',
        'A pays C directly).',
        '',
        'Would your design absorb this as a new derivation on top of the existing balance',
        'calculation, or would you have to edit Expense, Group or the split rules? Name',
        'the classes that would have to change.',
      ].join('\n'),
      unlocksAfterAttempt: 1,
      probesDimensionId: DimensionMeta.EXTENSIBILITY.id,
    }),
  });
}
