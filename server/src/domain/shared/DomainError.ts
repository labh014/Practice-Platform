/**
 * Base class for every error raised by the domain layer.
 *
 * Domain errors signal a broken invariant, not an infrastructure failure. The
 * API layer maps them to 4xx responses; anything else is a 500.
 */
export class DomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

/** A rubric was constructed with weights that do not sum to 100, or with duplicate dimensions. */
export class InvalidRubricError extends DomainError {}

/** A problem was constructed without requirements, or with duplicate requirement ids. */
export class InvalidProblemError extends DomainError {}

/** A submission was constructed with a shape the domain cannot represent. */
export class InvalidSubmissionError extends DomainError {}

/** A score fell outside its permitted range. */
export class InvalidScoreError extends DomainError {}

/**
 * An attempt was moved between statuses along an edge that does not exist.
 *
 * This is deliberately loud rather than forgiving: a silent illegal transition
 * would let an attempt be marked COMPLETED twice, or completed after it had
 * already failed, and the learner's history would quietly stop being true.
 */
export class InvalidAttemptTransitionError extends DomainError {}
