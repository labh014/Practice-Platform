import { ChangeScenario, Importance, Problem, Requirement } from '../domain';
import { buildRubric, DimensionMeta } from './rubricDimensions';

/**
 * In-Memory Cache with TTL and eviction - a policy-strategy problem.
 *
 * The design instinct exercised here is composing two orthogonal concerns
 * cleanly: entries expire because of time (TTL), and entries are evicted
 * because of capacity (LRU / LFU / FIFO). The classic mistake is one map plus a
 * doubly-linked list with policy switches sprinkled through both.
 */
export function buildCacheProblem(): Problem {
  return new Problem({
    id: 'in-memory-cache',
    title: 'In-Memory Cache',
    summary:
      'Design the classes behind a key-value cache with a pluggable eviction policy and ' +
      'per-entry time-to-live.',
    description: [
      'A cache holds recently used values for fast retrieval. Entries expire on their own',
      'clock (TTL) and are evicted when the cache is full using an eviction policy - LRU',
      'is common, but the operator may want LFU or FIFO instead. get and put must feel',
      'like a normal map to the caller.',
      '',
      'Design the classes, interfaces and relationships behind this. Method bodies can be',
      'empty; what is being assessed is how eviction policy and expiration are kept ' +
        'separate',
      "from the cache's storage, and how a new policy plugs in.",
      '',
      'A future variant of this cache will run in a distributed system; even in the ' +
        'single-node',
      'design here, the policy should not need to know how storage is implemented.',
    ].join('\n'),

    requirements: [
      new Requirement({
        id: 'R1',
        text:
          'Support get(key) and put(key, value, ttl) with a bounded capacity beyond ' +
          'which further puts trigger eviction.',
        importance: Importance.HIGH,
      }),
      new Requirement({
        id: 'R2',
        text:
          'Support at least two eviction policies (for example LRU and LFU), each ' +
          'expressed as something that could be swapped independently.',
        importance: Importance.HIGH,
      }),
      new Requirement({
        id: 'R3',
        text:
          'Expire entries whose TTL has passed - on read, on write, or through a sweep - ' +
          'without conflating expiration with eviction.',
        importance: Importance.HIGH,
      }),
      new Requirement({
        id: 'R4',
        text:
          'Access the current time through an abstraction so tests can advance the clock ' +
          'rather than sleep.',
        importance: Importance.HIGH,
      }),
      new Requirement({
        id: 'R5',
        text:
          'Allow a new eviction policy or a new expiration strategy to be introduced ' +
          'without modifying the classes that already exist.',
        importance: Importance.HIGH,
      }),
    ],

    rubric: buildRubric({
      COHESION: {
        low:
          'One class owns the map, the linked list, the TTL check and the eviction ' +
          "decision - or expiration and eviction are conflated into a single 'is this " +
          "entry stale' method.",
        mid:
          'The eviction policy is separated, but TTL is still checked inside the same ' +
          'method that returns a value, or the policy reaches into the storage type.',
        high:
          'Storage, eviction policy and expiration are each owned by their own type, and ' +
          'the cache class coordinates them rather than performing any of the three.',
      },
      COUPLING: {
        low:
          'Every dependency is on a concrete type. The eviction policy imports the ' +
          "storage class directly, and the clock is System.currentTimeMillis inlined " +
          'wherever it is needed.',
        mid:
          'An interface exists for eviction but not for the clock, or the policy still ' +
          'reaches into concrete storage internals to reorder its bookkeeping.',
        high:
          'Eviction policy, clock and storage are each addressed through abstractions, ' +
          'and each is justified by a named axis of change (or a testing need).',
      },
      COMPLETENESS: {
        low: 'Two or more HIGH requirements have no representation in the design at all.',
        mid:
          'Get and put work with one eviction policy, but TTL is either missing or ' +
          'checked in exactly one place (say, only on read), leaving stale entries to ' +
          'linger.',
        high:
          'Every HIGH requirement has a home, including a testable clock. The ' +
          'assumptions field states what was deliberately excluded (thread safety, ' +
          'persistence, size accounting).',
      },
      EXTENSIBILITY: {
        low:
          'A new eviction policy would mean editing the cache class and the storage type, ' +
          'and no trade-off is acknowledged.',
        mid:
          'A new eviction policy plugs in but a new expiration strategy (say, sliding ' +
          'TTL) would still require changes to the cache class.',
        high:
          'A new eviction policy and a new expiration strategy are each additive, and ' +
          'the submission names what the extra indirection costs (a policy call on every ' +
          'read) as well as what it buys.',
      },
    }),

    changeScenario: new ChangeScenario({
      id: 'CS-1',
      title: 'Thread-safe access',
      description: [
        'The cache is now accessed from many threads at once. Reads and writes must not ' +
          'corrupt',
        "the storage or the eviction policy's bookkeeping, and a high read-to-write ratio",
        'should not serialise on a global lock.',
        '',
        'Would your design absorb concurrency at the seams already present (storage, ' +
          'policy)',
        'or would you have to edit them? Name the classes that would have to change, and',
        'name the trade-off you would take (a single lock vs. striped locking vs. lock-free).',
      ].join('\n'),
      unlocksAfterAttempt: 1,
      probesDimensionId: DimensionMeta.EXTENSIBILITY.id,
    }),
  });
}
