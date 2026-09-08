import { DomainError } from '../shared/DomainError';
import type { DimensionId, FeedbackItemId } from '../shared/ids';
import type { FeedbackCategory } from './FeedbackCategory';
import type { Severity } from './Severity';

/**
 * One piece of actionable, evidence-backed criticism.
 *
 * The field list is the product thesis in miniature. Generic feedback -
 * "follow SOLID" - is what you get when an evaluator is reasoning about LLD in
 * the abstract instead of about this submission. Requiring evidence, a reason
 * and a suggestion makes that answer structurally impossible to give: there is
 * nowhere to put it.
 *
 *   evidence      - quoted from the learner's own text, and verified against it
 *   issue         - what is wrong
 *   whyItMatters  - the consequence, so the lesson generalises past this problem
 *   suggestion    - the concrete next move
 *   principle     - the named idea, so the learner can go read about it
 *   dimensionId   - ties the criticism to the score it cost
 */
export class FeedbackItem {
  readonly id: FeedbackItemId;
  /** The rubric dimension this issue counted against. */
  readonly dimensionId: DimensionId;
  readonly severity: Severity;
  readonly category: FeedbackCategory;
  /** A snippet lifted verbatim from the learner's submission. */
  readonly evidence: string;
  readonly issue: string;
  readonly whyItMatters: string;
  readonly suggestion: string;
  /** e.g. "Single Responsibility Principle". Null when no single principle applies. */
  readonly principle: string | null;
  /** e.g. "Strategy". Null when no pattern is relevant. */
  readonly pattern: string | null;

  constructor(params: {
    id: FeedbackItemId;
    dimensionId: DimensionId;
    severity: Severity;
    category: FeedbackCategory;
    evidence: string;
    issue: string;
    whyItMatters: string;
    suggestion: string;
    principle?: string | null;
    pattern?: string | null;
  }) {
    const required = ['evidence', 'issue', 'whyItMatters', 'suggestion'] as const;
    for (const field of required) {
      if (!params[field].trim()) {
        throw new DomainError(
          `FeedbackItem ${params.id} is missing "${field}". Every criticism must be ` +
            `specific, explained and actionable, or it is not worth showing.`,
        );
      }
    }

    this.id = params.id;
    this.dimensionId = params.dimensionId;
    this.severity = params.severity;
    this.category = params.category;
    this.evidence = params.evidence.trim();
    this.issue = params.issue.trim();
    this.whyItMatters = params.whyItMatters.trim();
    this.suggestion = params.suggestion.trim();
    this.principle = params.principle?.trim() || null;
    this.pattern = params.pattern?.trim() || null;
  }
}
