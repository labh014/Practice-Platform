import { categoryLabel, formatDelta, overallScoreColour } from '../../lib/format';
import type { ComparisonReport, DimensionDelta } from '../../types/api';

/**
 * What changed since the previous attempt.
 *
 * This panel is the product's whole reason for existing. Anyone can score a
 * design once; what teaches is being shown that the coupling problem you were
 * told about is gone, and that the two you did not address are still there.
 *
 * Every number here was computed from stored scores rather than written by the
 * evaluator, which is what lets it be stated as fact. The headline is
 * deliberately willing to be unflattering - a panel that only ever finds
 * progress is worth nothing to someone trying to tell whether they are actually
 * getting better.
 */
export function ImprovementDelta({ comparison }: { comparison: ComparisonReport }) {
  const headline = buildHeadline(comparison);

  return (
    <section className={`delta delta--${headline.tone}`}>
      <header className="delta__head">
        <h3 className="delta__title">Compared with attempt {comparison.previousAttemptNumber}</h3>

        <div className="delta__scores">
          <span className="delta__from">{comparison.previousOverallScore}</span>
          <span className="delta__arrow" aria-hidden>
            →
          </span>
          <span
            className="delta__to"
            style={{ color: overallScoreColour(comparison.currentOverallScore) }}
          >
            {comparison.currentOverallScore}
          </span>
          <span className={`delta__change delta__change--${headline.tone}`}>
            {formatDelta(comparison.overallDelta)}
          </span>
        </div>
      </header>

      <p className="delta__headline">{headline.text}</p>

      <ul className="delta__dimensions">
        {comparison.dimensionDeltas.map((delta) => (
          <DeltaRow key={delta.dimensionId} delta={delta} />
        ))}
      </ul>

      {comparison.dimensionDeltas.some((delta) => delta.scopeChanged) ? (
        <p className="delta__note">
          A dimension marked <strong>bar raised</strong> is being judged against the change
          scenario from this attempt onward. It is answering a harder question than last time,
          so a flat or lower score there is not evidence your design got worse.
        </p>
      ) : null}

      {comparison.resolvedCategories.length > 0 || comparison.persistingCategories.length > 0 ? (
        <div className="delta__categories">
          {comparison.resolvedCategories.length > 0 ? (
            <CategoryGroup
              label="Resolved"
              tone="resolved"
              categories={comparison.resolvedCategories}
            />
          ) : null}
          {comparison.persistingCategories.length > 0 ? (
            <CategoryGroup
              label="Still open"
              tone="persisting"
              categories={comparison.persistingCategories}
            />
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

function DeltaRow({ delta }: { delta: DimensionDelta }) {
  const tone =
    delta.direction === 'IMPROVED'
      ? 'improved'
      : delta.direction === 'REGRESSED'
        ? 'regressed'
        : 'unchanged';

  return (
    <li className="delta-row">
      <span className="delta-row__name">{delta.dimensionName}</span>

      {delta.scopeChanged ? <span className="delta-row__scope">bar raised</span> : null}

      <span className="delta-row__scores mono">
        {delta.previousScore} → {delta.currentScore}
      </span>
      <span className={`delta-row__change delta-row__change--${tone}`}>
        {delta.delta === 0 ? '—' : formatDelta(delta.delta)}
      </span>
    </li>
  );
}

function CategoryGroup({
  label,
  tone,
  categories,
}: {
  label: string;
  tone: 'resolved' | 'persisting';
  categories: ComparisonReport['resolvedCategories'];
}) {
  return (
    <div className="category-group">
      <span className={`category-group__label category-group__label--${tone}`}>{label}</span>
      <span className="category-group__items">
        {categories.map((category) => (
          <span key={category} className={`chip chip--${tone}`}>
            {categoryLabel(category)}
          </span>
        ))}
      </span>
    </div>
  );
}

/**
 * The one-sentence answer to "did I actually get better".
 *
 * Improvement and unfinished business are reported together rather than
 * averaged into a single verdict, because they are separate facts and the
 * second one is the more useful of the two. "Better, but the requirement gap is
 * still there" tells a learner what to do next; "+30" does not.
 */
function buildHeadline(comparison: ComparisonReport): {
  tone: 'improved' | 'regressed' | 'unchanged';
  text: string;
} {
  const previous = comparison.previousAttemptNumber;
  const persisting = comparison.persistingCategories.length;
  const resolved = comparison.resolvedCategories.length;

  // A drop confined to a dimension whose bar was raised is not a regression -
  // saying so would be reporting a change the learner did not cause.
  const genuineRegressions = comparison.dimensionDeltas.filter(
    (delta) => delta.delta < 0 && !delta.scopeChanged,
  );

  if (comparison.overallDelta > 0) {
    return {
      tone: 'improved',
      text: persisting
        ? `Stronger than attempt ${previous}${resolved ? `, and ${resolved} kind${resolved === 1 ? '' : 's'} of issue cleared` : ''} — but ${persisting} ${persisting === 1 ? 'is' : 'are'} still open below.`
        : `Stronger than attempt ${previous} across the board, with nothing left outstanding.`,
    };
  }

  if (comparison.overallDelta === 0) {
    return {
      tone: 'unchanged',
      text: persisting
        ? `Same overall score as attempt ${previous}, and ${persisting} issue ${persisting === 1 ? 'type is' : 'types are'} still open. Something moved, but not the things that were costing you.`
        : `Same overall score as attempt ${previous}.`,
    };
  }

  if (genuineRegressions.length === 0) {
    return {
      tone: 'unchanged',
      text: `Lower than attempt ${previous}, but only where the bar was raised by the change scenario. Your design did not get worse.`,
    };
  }

  return {
    tone: 'regressed',
    text: `Lower than attempt ${previous}. ${genuineRegressions.length} dimension${genuineRegressions.length === 1 ? '' : 's'} went backwards — worth checking what the last version did better.`,
  };
}
