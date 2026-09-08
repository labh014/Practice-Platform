/**
 * How much a finding should worry the learner.
 *
 * Severity exists to make feedback prioritisable. A list of twelve equally
 * weighted observations is not actionable; the learner needs to know which two
 * things to fix before their next attempt.
 */
export const Severity = {
  /** A design flaw that would fail an interview or break under the stated requirements. */
  CRITICAL: 'CRITICAL',
  /** A real weakness worth fixing, but the design still holds together. */
  MAJOR: 'MAJOR',
  /** A refinement or polish point. */
  MINOR: 'MINOR',
} as const;

export type Severity = (typeof Severity)[keyof typeof Severity];

const ORDER: Record<Severity, number> = {
  [Severity.CRITICAL]: 0,
  [Severity.MAJOR]: 1,
  [Severity.MINOR]: 2,
};

/** Sorts CRITICAL first so the learner reads what matters most, first. */
export function compareSeverity(a: Severity, b: Severity): number {
  return ORDER[a] - ORDER[b];
}

/** Severities that count as an open issue on a dimension when computing deltas. */
export function isBlockingSeverity(severity: Severity): boolean {
  return severity === Severity.CRITICAL || severity === Severity.MAJOR;
}
