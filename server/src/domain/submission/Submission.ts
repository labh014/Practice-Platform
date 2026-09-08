import { InvalidSubmissionError } from '../shared/DomainError';

/** Below this, a field is present but too thin to reason about. */
const THIN_FIELD_CHAR_THRESHOLD = 40;

/**
 * What the learner actually submits: three plain-text fields.
 *
 * The three-field shape is the product's most consequential decision. A single
 * free-text box produces prose that cannot be anchored to, and full runnable
 * code costs the learner twenty minutes before any feedback exists. Splitting
 * design from reasoning captures the part an interviewer actually probes - why
 * you drew the boundaries where you did - and keeps every claim in the feedback
 * traceable to a specific field.
 *
 * A Submission is immutable. A revision is a new attempt, never an edit, which
 * is what makes the attempt history a truthful record of how the learner's
 * thinking changed.
 */
export class Submission {
  /** Classes, interfaces, methods, relationships. */
  readonly designSkeleton: string;
  /** Why those abstractions, in the learner's own words. */
  readonly designDecisions: string;
  /** What was deliberately included, excluded, or left for later. */
  readonly assumptions: string;

  private constructor(designSkeleton: string, designDecisions: string, assumptions: string) {
    this.designSkeleton = designSkeleton;
    this.designDecisions = designDecisions;
    this.assumptions = assumptions;
  }

  /**
   * Trims each field and constructs the submission.
   *
   * Empty input is deliberately allowed. PRD 7.1 requires an empty submission
   * to produce structural signals, and PRD 4.1 forbids those signals from
   * short-circuiting the evaluator - so emptiness is a thing to be evaluated
   * and reported on, not a thing to be rejected at the door. Only a
   * structurally impossible submission (non-string input) is refused here.
   */
  static create(params: {
    designSkeleton: string;
    designDecisions: string;
    assumptions: string;
  }): Submission {
    const fields = ['designSkeleton', 'designDecisions', 'assumptions'] as const;
    for (const field of fields) {
      if (typeof params[field] !== 'string') {
        throw new InvalidSubmissionError(`Submission field "${field}" must be a string`);
      }
    }

    return new Submission(
      params.designSkeleton.trim(),
      params.designDecisions.trim(),
      params.assumptions.trim(),
    );
  }

  /** True when the learner submitted nothing at all. */
  isEmpty(): boolean {
    return (
      this.designSkeleton.length === 0 &&
      this.designDecisions.length === 0 &&
      this.assumptions.length === 0
    );
  }

  hasDesignSkeleton(): boolean {
    return this.designSkeleton.length > 0;
  }

  hasThinDesignDecisions(): boolean {
    return this.designDecisions.length < THIN_FIELD_CHAR_THRESHOLD;
  }

  hasThinAssumptions(): boolean {
    return this.assumptions.length < THIN_FIELD_CHAR_THRESHOLD;
  }

  /**
   * All three fields as one searchable body of text.
   *
   * Used by EvidenceVerifier (Phase 3) to confirm that a snippet the evaluator
   * quoted back actually came from the learner, rather than being invented.
   */
  get combinedText(): string {
    return [this.designSkeleton, this.designDecisions, this.assumptions]
      .filter((field) => field.length > 0)
      .join('\n\n');
  }

  get totalCharacterCount(): number {
    return this.designSkeleton.length + this.designDecisions.length + this.assumptions.length;
  }

  get designSkeletonLineCount(): number {
    if (!this.hasDesignSkeleton()) return 0;
    return this.designSkeleton.split('\n').filter((line) => line.trim().length > 0).length;
  }
}
