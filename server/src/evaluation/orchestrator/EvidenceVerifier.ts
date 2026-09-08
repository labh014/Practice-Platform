import type { FeedbackItem, Submission } from '../../domain';

export interface EvidenceVerification {
  /** Feedback whose evidence was found in the submission. */
  readonly kept: readonly FeedbackItem[];
  /** Feedback discarded because its evidence could not be located. */
  readonly discarded: readonly FeedbackItem[];
}

/**
 * Confirms that quoted evidence actually came from the learner.
 *
 * The PRD tells the model it "must not invent classes or methods". That is a
 * request, and a request is not a guarantee - so this turns it into one. Every
 * feedback item is checked against the submission text after validation, and
 * anything quoting a class the learner never wrote is dropped before they see
 * it (assumption A4).
 *
 * The bias is deliberately toward discarding. Dropping a real criticism costs
 * the learner one piece of advice; showing them a critique of a `BookingService`
 * they never wrote costs the platform its credibility, and after that they have
 * no reason to believe the findings that were correct. Trust is the scarcer
 * resource, so borderline cases lose.
 *
 * Matching is forgiving about presentation and strict about content: whitespace
 * is collapsed, case is ignored and wrapping punctuation is stripped, because a
 * model reformatting a snippet is not the failure mode this guards against.
 */
export class EvidenceVerifier {
  verify(feedback: readonly FeedbackItem[], submission: Submission): EvidenceVerification {
    const haystack = normalise(submission.combinedText);

    const kept: FeedbackItem[] = [];
    const discarded: FeedbackItem[] = [];

    for (const item of feedback) {
      if (this.isGrounded(item.evidence, haystack)) {
        kept.push(item);
      } else {
        discarded.push(item);
      }
    }

    return { kept, discarded };
  }

  private isGrounded(evidence: string, haystack: string): boolean {
    const needle = normalise(stripWrappers(evidence));

    // An empty submission legitimately produces "(empty)" as its evidence;
    // the domain forbids a blank evidence field, so this is the marker for it.
    if (needle.length === 0) return false;
    if (needle === '(empty)') return true;

    return haystack.includes(needle);
  }
}

/** Collapses whitespace and lowercases, so formatting differences do not matter. */
function normalise(text: string): string {
  return text.replace(/\s+/g, ' ').trim().toLowerCase();
}

/** Removes quotes, backticks and trailing separators a model may add around a snippet. */
function stripWrappers(text: string): string {
  return text
    .trim()
    .replace(/^[`'"“‘]+/, '')
    .replace(/[`'"”’]+$/, '')
    .replace(/[;,]+$/, '')
    .trim();
}
