import { DomainError } from '../shared/DomainError';

/**
 * A design choice acknowledged as a genuine trade-off rather than a mistake.
 *
 * LLD has no single correct answer, and an evaluator that pretends otherwise
 * teaches learners to chase one house style instead of learning to reason. When
 * the learner has made a defensible call with real costs - a single queue that
 * is simpler but harder to scale, say - the platform should name both sides
 * rather than mark it wrong.
 *
 * This is also a check on the evaluator itself: an LLM that cannot articulate
 * the upside of a decision it dislikes usually has not understood the design.
 */
export class TradeOff {
  /** The choice the learner made. */
  readonly decision: string;
  /** What it buys them. */
  readonly upside: string;
  /** What it costs them. */
  readonly downside: string;

  constructor(params: { decision: string; upside: string; downside: string }) {
    const required = ['decision', 'upside', 'downside'] as const;
    for (const field of required) {
      if (!params[field].trim()) {
        throw new DomainError(
          `TradeOff is missing "${field}"; a trade-off with only one side is a verdict`,
        );
      }
    }

    this.decision = params.decision.trim();
    this.upside = params.upside.trim();
    this.downside = params.downside.trim();
  }
}
