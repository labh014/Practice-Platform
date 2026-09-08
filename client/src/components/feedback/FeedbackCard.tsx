import { categoryLabel, severityColour } from '../../lib/format';
import type { FeedbackItem } from '../../types/api';

/**
 * One piece of criticism, rendered as the structure that makes it teachable.
 *
 * The order is the argument: what is wrong, the line in your own code that
 * shows it, the consequence, and the change to make. Evidence sits between the
 * claim and the reasoning because that is where a sceptical reader needs it -
 * the natural response to "your ParkingLot does too much" is "where?", and the
 * answer should already be on screen.
 *
 * Principle and pattern are shown last, as labels rather than advice. They are
 * what turns one fix into something the learner can carry to the next problem,
 * but leading with "Single Responsibility Principle" would be the generic
 * feedback this product exists to avoid.
 */
export function FeedbackCard({ item }: { item: FeedbackItem }) {
  const colour = severityColour(item.severity);

  return (
    <article
      className="feedback-card"
      style={{ borderLeftColor: colour.fg, background: colour.bg }}
    >
      <header className="feedback-card__head">
        <span
          className="badge feedback-card__severity"
          style={{ color: colour.fg, borderColor: colour.border, background: 'transparent' }}
        >
          {item.severity}
        </span>
        <span className="feedback-card__category">{categoryLabel(item.category)}</span>
        <span className="subtle feedback-card__dimension">{item.dimensionName}</span>
      </header>

      <h4 className="feedback-card__issue">{item.issue}</h4>

      <figure className="evidence">
        <figcaption className="evidence__label">From your submission</figcaption>
        <pre className="evidence__code">{item.evidence}</pre>
      </figure>

      <div className="feedback-card__section">
        <h5 className="feedback-card__label">Why it matters</h5>
        <p className="feedback-card__body">{item.whyItMatters}</p>
      </div>

      <div className="feedback-card__section">
        <h5 className="feedback-card__label">What to change</h5>
        <p className="feedback-card__body">{item.suggestion}</p>
      </div>

      {item.principle || item.pattern ? (
        <footer className="feedback-card__foot">
          {item.principle ? (
            <span className="chip chip--principle">{item.principle}</span>
          ) : null}
          {item.pattern ? (
            <span className="chip chip--pattern">{item.pattern} pattern</span>
          ) : null}
        </footer>
      ) : null}
    </article>
  );
}
