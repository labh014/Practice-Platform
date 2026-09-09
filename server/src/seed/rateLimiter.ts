import { ChangeScenario, Importance, Problem, Requirement } from '../domain';
import { buildRubric, DimensionMeta } from './rubricDimensions';

/**
 * Rate Limiter - an algorithm-strategy problem with a storage seam.
 *
 * The design instinct is different again: two orthogonal axes vary (which
 * algorithm counts requests, and where those counts live), and the tempting
 * mistake is a single limiter class that bakes both in - Redis + fixed window
 * hard-coded together.
 */
export function buildRateLimiterProblem(): Problem {
  return new Problem({
    id: 'rate-limiter',
    title: 'Rate Limiter',
    summary:
      'Design the classes behind a rate limiter: deciding whether an incoming request is ' +
      'allowed, using a pluggable algorithm and a pluggable storage backend.',
    description: [
      'A rate limiter guards an API. For each incoming request it looks up the caller',
      "(by IP, by API key), consults a rule (e.g. 100 requests per minute per key), and",
      'answers allow or deny. Different endpoints may use different algorithms - a fixed',
      'window is enough for cheap endpoints, sliding window or token bucket for the ones',
      'that matter.',
      '',
      'Design the classes, interfaces and relationships behind this. Method bodies can be',
      'empty; what is being assessed is how the counting algorithm is separated from ' +
        'where',
      'counts are stored, and how a rule is expressed independently of both.',
      '',
      'The platform runs across multiple hosts. Today counters live in memory; tomorrow',
      'they need to live in Redis. That swap should not touch the algorithm.',
    ].join('\n'),

    requirements: [
      new Requirement({
        id: 'R1',
        text:
          'Given an identifier and a rule, decide allow or deny and record the decision ' +
          "against that identifier's counter.",
        importance: Importance.HIGH,
      }),
      new Requirement({
        id: 'R2',
        text:
          'Support at least two counting algorithms (for example fixed window and token ' +
          'bucket), each expressed as something that could be swapped independently.',
        importance: Importance.HIGH,
      }),
      new Requirement({
        id: 'R3',
        text:
          'Read and write counters through a storage abstraction so the same algorithm ' +
          'runs against in-memory storage in tests and Redis in production.',
        importance: Importance.HIGH,
      }),
      new Requirement({
        id: 'R4',
        text:
          'Express a rule (limit, window, scope such as per-key or per-IP) as data the ' +
          "limiter reads, not as code hard-wired into one algorithm's implementation.",
        importance: Importance.HIGH,
      }),
      new Requirement({
        id: 'R5',
        text:
          'Allow a new algorithm or a new storage backend to be introduced without ' +
          'modifying the classes that already exist.',
        importance: Importance.HIGH,
      }),
    ],

    rubric: buildRubric({
      COHESION: {
        low:
          'A single class picks the algorithm, reads and writes storage, and encodes the ' +
          "rules. The two axes of change are not visible in the design at all.",
        mid:
          'Algorithm is separated, but it still reaches directly into a concrete store, ' +
          'or the rule is baked into the algorithm rather than passed in.',
        high:
          'Algorithm, storage and rule are each owned by their own type, and the limiter ' +
          'coordinates them rather than performing any of the three.',
      },
      COUPLING: {
        low:
          'Every dependency is on a concrete type. The word "Redis" appears next to the ' +
          'word "check" somewhere in the design.',
        mid:
          'A storage interface exists but the algorithm interface does not, or an ' +
          'algorithm abstraction has been added where only one implementation will exist.',
        high:
          'Both algorithm and storage are addressed through abstractions, and each one is ' +
          'justified by a variation the problem actually has.',
      },
      COMPLETENESS: {
        low: 'Two or more HIGH requirements have no representation in the design at all.',
        mid:
          'The allow-or-deny path is covered for one algorithm, but rules are hard-coded ' +
          'or the storage seam is missing.',
        high:
          'Every HIGH requirement has a home. Two algorithms are represented, rules are ' +
          'data, and the assumptions field states what was deliberately excluded (clock ' +
          'skew, storage failure modes, hot keys).',
      },
      EXTENSIBILITY: {
        low:
          'A new algorithm or a new storage backend would mean editing the limiter, and ' +
          'no trade-off is acknowledged.',
        mid:
          'One axis extends cleanly (usually storage) while the other still requires ' +
          'edits to existing types.',
        high:
          'A new algorithm and a new storage backend are each additive, and the ' +
          'submission names the cost of the seams it introduced (latency of a store call, ' +
          'race conditions across nodes) as well as their benefit.',
      },
    }),

    changeScenario: new ChangeScenario({
      id: 'CS-1',
      title: 'Distributed rate limiting',
      description: [
        'The service now runs across many hosts and the same API key can hit any of',
        'them. Rate limits must be global rather than per-host, and the algorithm must',
        'tolerate a Redis call taking a millisecond rather than being free.',
        '',
        'Would your design absorb this by adding a new storage implementation and, if',
        'needed, an algorithm variant that batches or approximates? Or would you have to',
        'edit the classes you have already written? Name the ones that would have to change.',
      ].join('\n'),
      unlocksAfterAttempt: 1,
      probesDimensionId: DimensionMeta.EXTENSIBILITY.id,
    }),
  });
}
