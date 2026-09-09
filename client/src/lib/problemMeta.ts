/**
 * Client-side metadata for each seeded problem.
 *
 * Category, difficulty and focus are display-only signals; the server does not
 * emit them and the rubric does not use them, so they live here rather than in
 * the domain. Keeping the map next to the catalogue means a new problem is one
 * server file plus one entry here, and the UI degrades to a plain listing for
 * anything the map does not know about.
 */

export type ProblemCategory =
  | 'state-machine'
  | 'policy-strategy'
  | 'data-modelling'
  | 'system-integration'
  | 'concurrency';

export type ProblemDifficulty = 'Easy' | 'Medium' | 'Hard';

export interface ProblemMeta {
  category: ProblemCategory;
  difficulty: ProblemDifficulty;
  /** One-line "what this problem is really testing", shown as a tag on the card. */
  focus: string;
}

export const CATEGORY_LABELS: Record<ProblemCategory, string> = {
  'state-machine': 'State machine',
  'policy-strategy': 'Policy & strategy',
  'data-modelling': 'Data modelling',
  'system-integration': 'System & integration',
  concurrency: 'Concurrency',
};

/**
 * Category → hue for the accent strip on each card. Uses the existing
 * severity/score tokens plus one extra accent so nothing new leaks into the
 * palette. Kept as CSS custom-property references so dark mode is free.
 */
export const CATEGORY_ACCENT: Record<ProblemCategory, { fg: string; bg: string; border: string }> = {
  'state-machine': {
    fg: 'var(--major)',
    bg: 'var(--major-soft)',
    border: 'var(--major-border)',
  },
  'policy-strategy': {
    fg: 'var(--accent)',
    bg: 'var(--accent-soft)',
    border: 'var(--accent-border)',
  },
  'data-modelling': {
    fg: 'var(--score-high)',
    bg: 'var(--improved-soft)',
    border: 'var(--improved-soft)',
  },
  'system-integration': {
    fg: 'var(--minor)',
    bg: 'var(--minor-soft)',
    border: 'var(--minor-border)',
  },
  concurrency: {
    fg: 'var(--critical)',
    bg: 'var(--critical-soft)',
    border: 'var(--critical-border)',
  },
};

export const PROBLEM_META: Record<string, ProblemMeta> = {
  'parking-lot': {
    category: 'policy-strategy',
    difficulty: 'Medium',
    focus: 'Two independent axes of change',
  },
  'vending-machine': {
    category: 'state-machine',
    difficulty: 'Easy',
    focus: 'Legal transitions between situations',
  },
  'elevator-system': {
    category: 'state-machine',
    difficulty: 'Hard',
    focus: 'Coordinating many small state machines',
  },
  splitwise: {
    category: 'data-modelling',
    difficulty: 'Medium',
    focus: 'Derived state, pluggable rules',
  },
  'rate-limiter': {
    category: 'policy-strategy',
    difficulty: 'Medium',
    focus: 'Algorithm and storage as separate seams',
  },
  'notification-service': {
    category: 'system-integration',
    difficulty: 'Medium',
    focus: 'Routing, templating, delivery',
  },
  'in-memory-cache': {
    category: 'concurrency',
    difficulty: 'Hard',
    focus: 'Composing eviction, expiration and locking',
  },
};

export function metaFor(problemId: string): ProblemMeta | null {
  return PROBLEM_META[problemId] ?? null;
}

export const DIFFICULTY_ORDER: Record<ProblemDifficulty, number> = {
  Easy: 0,
  Medium: 1,
  Hard: 2,
};
