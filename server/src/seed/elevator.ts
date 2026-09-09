import { ChangeScenario, Importance, Problem, Requirement } from '../domain';
import { buildRubric, DimensionMeta } from './rubricDimensions';

/**
 * Elevator System - a state-machine and scheduling problem.
 *
 * Where Parking Lot rewards separating things that change on different schedules
 * and Vending Machine rewards modelling state, this one is about the interplay
 * of many small state machines (each car) with a policy that lives above them
 * (the dispatcher). The classic mistake is a monolithic controller with a
 * priority queue and an if-ladder deciding everything.
 */
export function buildElevatorProblem(): Problem {
  return new Problem({
    id: 'elevator-system',
    title: 'Elevator System',
    summary:
      'Design the classes behind a building with multiple elevators: taking hall calls, ' +
      'dispatching a car and moving it through its own motion states.',
    description: [
      'A building has several elevators serving many floors. People press a hall button on',
      'a floor (up or down); once inside, they press a floor button. A dispatcher decides',
      "which car answers a given hall call. Each car has its own motion: idle, moving up,",
      'moving down, doors opening, doors closing, out of service.',
      '',
      'Design the classes, interfaces and relationships behind this. Method bodies can be',
      "empty; what is being assessed is how the dispatcher's policy is separated from a",
      "car's motion, and how each car's legal transitions are expressed.",
      '',
      'The building operator expects the dispatching policy to change (nearest-car today,',
      'destination-dispatch tomorrow) independently of how a single car moves.',
    ].join('\n'),

    requirements: [
      new Requirement({
        id: 'R1',
        text:
          'Represent multiple elevator cars, each holding its own current floor, motion ' +
          'direction and door state.',
        importance: Importance.HIGH,
      }),
      new Requirement({
        id: 'R2',
        text:
          'Accept a hall call (floor plus direction) and route it to one car through a ' +
          'dispatching policy that is expressed as something that could later be changed.',
        importance: Importance.HIGH,
      }),
      new Requirement({
        id: 'R3',
        text:
          'Accept a cabin request (a destination floor pressed inside a car) and add it ' +
          "to that car's pending stops without touching any other car.",
        importance: Importance.HIGH,
      }),
      new Requirement({
        id: 'R4',
        text:
          'Model each car as moving between distinct motion states (idle, moving, doors ' +
          'opening, doors closing, out of service) with only the transitions legal from ' +
          'each one.',
        importance: Importance.HIGH,
      }),
      new Requirement({
        id: 'R5',
        text:
          'Allow a new dispatching policy or a new car type to be introduced without ' +
          'modifying the classes that already exist.',
        importance: Importance.HIGH,
      }),
    ],

    rubric: buildRubric({
      COHESION: {
        low:
          'A single controller owns hall-call dispatch, cabin request queueing and each ' +
          "car's motion, or the split does not follow any consistent reason to change.",
        mid:
          'The dispatcher and a car are separated, but the car still owns two independent ' +
          'jobs - typically motion state alongside its own pending stops list.',
        high:
          'Dispatching, per-car request queueing and per-car motion are each owned by ' +
          'their own type, and the system class coordinates them rather than performing ' +
          'them.',
      },
      COUPLING: {
        low:
          "The dispatcher reaches into each car's concrete fields, and motion decisions " +
          'are decided by inline conditionals on state flags.',
        mid:
          'An abstraction exists for the dispatching policy but the car type is still ' +
          'concrete, or a state interface has been added where only one implementation ' +
          'will ever exist.',
        high:
          'The dispatcher depends on an interface, cars are accessed through a stable ' +
          'contract, and each abstraction is justified by a variation the problem ' +
          'actually has.',
      },
      COMPLETENESS: {
        low: 'Two or more HIGH requirements have no representation in the design at all.',
        mid:
          'Hall calls and cabin requests are modelled, but at least one motion transition ' +
          'is missing - out-of-service handling and door-cycle states are the usual ' +
          'omissions.',
        high:
          'Every HIGH requirement has a home, including out-of-service handling, and the ' +
          'assumptions field states which edge cases (fires, VIP mode, weight limits) ' +
          'were deliberately excluded.',
      },
      EXTENSIBILITY: {
        low:
          'A new dispatching policy or a new car type would mean editing existing ' +
          'conditionals, and no trade-off is acknowledged.',
        mid:
          'One of dispatching or car type extends cleanly while the other still requires ' +
          'edits to existing types.',
        high:
          'A new dispatching policy and a new car type are each additive, and the ' +
          'submission names the cost of the indirection it introduced as well as its ' +
          'benefit.',
      },
    }),

    changeScenario: new ChangeScenario({
      id: 'CS-1',
      title: 'Express elevators',
      description: [
        'The building is adding express elevators that only stop at floors 20 and above,',
        'plus the lobby. Regular hall calls from floors 2-19 must not be routed to them.',
        '',
        'Would your design absorb this by adding a new car type or a new dispatching rule,',
        'or would you have to edit classes you have already written? Name the ones that',
        'would have to change.',
      ].join('\n'),
      unlocksAfterAttempt: 1,
      probesDimensionId: DimensionMeta.EXTENSIBILITY.id,
    }),
  });
}
