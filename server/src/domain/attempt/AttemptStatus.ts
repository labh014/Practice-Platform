/**
 * Where an attempt is in its lifecycle.
 *
 *   SUBMITTED  - stored and acknowledged; the learner's work is safe
 *   EVALUATING - evaluation in flight
 *   COMPLETED  - feedback available
 *   FAILED     - evaluation did not produce a usable result; submission intact
 *
 * FAILED is a first-class state, not an error swallowed somewhere. An LLM can
 * return malformed JSON or time out, and when it does the learner must still
 * see that their work was received and be able to ask for another evaluation
 * without retyping a word of it.
 */
export const AttemptStatus = {
  SUBMITTED: 'SUBMITTED',
  EVALUATING: 'EVALUATING',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
} as const;

export type AttemptStatus = (typeof AttemptStatus)[keyof typeof AttemptStatus];

/**
 * The only legal transitions.
 *
 * FAILED -> EVALUATING is what makes retry possible. COMPLETED is terminal:
 * a revision is a new attempt, so that history stays an honest record.
 */
export const ALLOWED_TRANSITIONS: Readonly<Record<AttemptStatus, readonly AttemptStatus[]>> =
  Object.freeze({
    [AttemptStatus.SUBMITTED]: [AttemptStatus.EVALUATING],
    [AttemptStatus.EVALUATING]: [AttemptStatus.COMPLETED, AttemptStatus.FAILED],
    [AttemptStatus.COMPLETED]: [],
    [AttemptStatus.FAILED]: [AttemptStatus.EVALUATING],
  });

export function canTransition(from: AttemptStatus, to: AttemptStatus): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}

/** Statuses where the client should keep polling. */
export function isPendingStatus(status: AttemptStatus): boolean {
  return status === AttemptStatus.SUBMITTED || status === AttemptStatus.EVALUATING;
}
