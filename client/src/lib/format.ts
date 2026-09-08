import type { AttemptStatus, FeedbackCategory, Severity } from '../types/api';

/**
 * Colour for a 0-5 dimension score, matching the rubric's own three bands.
 *
 * The thresholds are the band boundaries rather than arbitrary cutoffs, so the
 * colour a learner sees always agrees with the written standard beside it.
 */
export function scoreColour(score: number, maxScore = 5): string {
  const ratio = maxScore === 0 ? 0 : score / maxScore;
  if (ratio >= 0.8) return 'var(--score-high)';
  if (ratio >= 0.4) return 'var(--score-mid)';
  return 'var(--score-low)';
}

/** Colour for the 0-100 overall score, on the same scale. */
export function overallScoreColour(score: number): string {
  return scoreColour(score, 100);
}

export function severityColour(severity: Severity): {
  fg: string;
  bg: string;
  border: string;
} {
  switch (severity) {
    case 'CRITICAL':
      return { fg: 'var(--critical)', bg: 'var(--critical-soft)', border: 'var(--critical-border)' };
    case 'MAJOR':
      return { fg: 'var(--major)', bg: 'var(--major-soft)', border: 'var(--major-border)' };
    case 'MINOR':
      return { fg: 'var(--minor)', bg: 'var(--minor-soft)', border: 'var(--minor-border)' };
  }
}

/** Human-readable category labels. The wire format is SCREAMING_SNAKE. */
const CATEGORY_LABELS: Record<FeedbackCategory, string> = {
  COHESION: 'Cohesion',
  COUPLING: 'Coupling',
  ABSTRACTION: 'Abstraction',
  EXTENSIBILITY: 'Extensibility',
  REQUIREMENT_GAP: 'Requirement gap',
  ENCAPSULATION: 'Encapsulation',
  PATTERN_MISUSE: 'Pattern misuse',
  INHERITANCE_MISUSE: 'Inheritance misuse',
  NAMING: 'Naming',
  EDGE_CASE: 'Edge case',
  INSUFFICIENT_DETAIL: 'Insufficient detail',
};

export function categoryLabel(category: FeedbackCategory): string {
  return CATEGORY_LABELS[category] ?? category;
}

export function statusLabel(status: AttemptStatus): string {
  switch (status) {
    case 'SUBMITTED':
      return 'Submitted';
    case 'EVALUATING':
      return 'Evaluating';
    case 'COMPLETED':
      return 'Reviewed';
    case 'FAILED':
      return 'Evaluation failed';
  }
}

export function isPendingStatus(status: AttemptStatus): boolean {
  return status === 'SUBMITTED' || status === 'EVALUATING';
}

/** Signed delta, so an unchanged score reads as "0" rather than nothing. */
export function formatDelta(delta: number): string {
  if (delta > 0) return `+${delta}`;
  return String(delta);
}

export function formatDate(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}
