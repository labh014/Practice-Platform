import { InvalidProblemError } from '../shared/DomainError';
import type { ChangeScenarioId, DimensionId } from '../shared/ids';

/**
 * A new requirement revealed after the learner's first attempt, used to test
 * whether their design actually absorbs change.
 *
 * This is the honest way to measure extensibility. Asking an evaluator "is this
 * design extensible?" invites a vague answer. Asking "would adding EV charging
 * force edits to existing classes, or only new ones?" has a defensible answer
 * grounded in what the learner actually wrote.
 *
 * Design note (assumption A1). A change scenario deliberately does NOT become
 * an additional Requirement. If it did, attempt 2 would be graded against a
 * larger requirement set than attempt 1, so a learner could genuinely improve
 * their design and still see their score fall - which would make the
 * Improvement Delta report a regression that never happened. Instead the
 * scenario is routed to a single dimension (`probesDimensionId`, normally
 * Extensibility & Trade-offs) as a probe. The other dimensions stay measured
 * against unchanged goalposts, so attempt-over-attempt comparison remains true.
 */
export class ChangeScenario {
  readonly id: ChangeScenarioId;
  readonly title: string;
  readonly description: string;
  /**
   * The attempt number after which this scenario becomes visible.
   * With a value of 1, the scenario is revealed once attempt 1 exists and
   * applies from attempt 2 onward.
   */
  readonly unlocksAfterAttempt: number;
  /** The rubric dimension this scenario informs. */
  readonly probesDimensionId: DimensionId;

  constructor(params: {
    id: ChangeScenarioId;
    title: string;
    description: string;
    unlocksAfterAttempt: number;
    probesDimensionId: DimensionId;
  }) {
    const { id, title, description, unlocksAfterAttempt, probesDimensionId } = params;

    if (!id.trim()) {
      throw new InvalidProblemError('Change scenario id must not be empty');
    }
    if (!title.trim()) {
      throw new InvalidProblemError(`Change scenario ${id} must have a title`);
    }
    if (!description.trim()) {
      throw new InvalidProblemError(`Change scenario ${id} must have a description`);
    }
    if (!Number.isInteger(unlocksAfterAttempt) || unlocksAfterAttempt < 1) {
      throw new InvalidProblemError(
        `Change scenario ${id} must unlock after attempt 1 or later, got ${unlocksAfterAttempt}`,
      );
    }
    if (!probesDimensionId.trim()) {
      throw new InvalidProblemError(
        `Change scenario ${id} must name the dimension it probes, so its effect on ` +
          `scoring stays explainable to the learner`,
      );
    }

    this.id = id;
    this.title = title.trim();
    this.description = description.trim();
    this.unlocksAfterAttempt = unlocksAfterAttempt;
    this.probesDimensionId = probesDimensionId;
  }

  /** Whether this scenario applies to the given attempt number. */
  isActiveForAttempt(attemptNumber: number): boolean {
    return attemptNumber > this.unlocksAfterAttempt;
  }
}
