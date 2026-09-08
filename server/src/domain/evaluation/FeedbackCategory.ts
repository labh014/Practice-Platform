/**
 * The kind of design concern a finding is about.
 *
 * A closed set rather than free text. Constraining the evaluator to name a
 * category forces it to classify what it saw, which is a meaningfully harder
 * task than producing a sentence of prose - and it is what makes issues
 * comparable across attempts, so the platform can say "the coupling problem
 * from attempt 1 is gone" instead of guessing from wording.
 */
export const FeedbackCategory = {
  /** A class doing several jobs that change for different reasons. */
  COHESION: 'COHESION',
  /** Concrete dependencies where an abstraction was needed. */
  COUPLING: 'COUPLING',
  /** A missing, wrong, or leaky abstraction boundary. */
  ABSTRACTION: 'ABSTRACTION',
  /** Adding the next variation would mean editing existing classes. */
  EXTENSIBILITY: 'EXTENSIBILITY',
  /** A stated requirement the design does not address. */
  REQUIREMENT_GAP: 'REQUIREMENT_GAP',
  /** Internal state or invariants exposed to callers. */
  ENCAPSULATION: 'ENCAPSULATION',
  /** A design pattern applied where it adds ceremony rather than value. */
  PATTERN_MISUSE: 'PATTERN_MISUSE',
  /** Inheritance used where composition was the better fit. */
  INHERITANCE_MISUSE: 'INHERITANCE_MISUSE',
  /** Names that hide or misstate what a type does. */
  NAMING: 'NAMING',
  /** An unhandled boundary condition in the design. */
  EDGE_CASE: 'EDGE_CASE',
  /** The submission is too thin to assess on its merits. */
  INSUFFICIENT_DETAIL: 'INSUFFICIENT_DETAIL',
} as const;

export type FeedbackCategory = (typeof FeedbackCategory)[keyof typeof FeedbackCategory];

export const ALL_FEEDBACK_CATEGORIES = Object.values(FeedbackCategory);
