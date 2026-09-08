import { overallScoreColour, scoreColour } from '../../lib/format';
import type { DimensionScore } from '../../types/api';

interface ScoreSummaryProps {
  overallScore: number;
  dimensionScores: DimensionScore[];
  evaluatorModel: string;
}

/**
 * The scorecard.
 *
 * Every number here is shown with the reason it was given: the band descriptor
 * says what this score means on this dimension, and the justification says why
 * this submission landed there. A score without both is a verdict, and a
 * verdict teaches nothing.
 *
 * The note about how the overall is derived is deliberate too. A learner who
 * can see that 40/100 is four weighted dimension scores, and not an opaque
 * judgement, can argue with the parts they disagree with.
 */
export function ScoreSummary({
  overallScore,
  dimensionScores,
  evaluatorModel,
}: ScoreSummaryProps) {
  return (
    <section className="scorecard">
      <header className="scorecard__head">
        <div className="scorecard__overall">
          <span
            className="scorecard__overall-value"
            style={{ color: overallScoreColour(overallScore) }}
          >
            {overallScore}
          </span>
          <span className="scorecard__overall-max subtle">/100</span>
        </div>

        <p className="subtle scorecard__derivation">
          Weighted from the {dimensionScores.length} dimension scores below, not assigned
          directly. Evaluated by {evaluatorModel}.
        </p>
      </header>

      <ul className="dimensions">
        {dimensionScores.map((score) => (
          <DimensionRow key={score.dimensionId} score={score} />
        ))}
      </ul>
    </section>
  );
}

function DimensionRow({ score }: { score: DimensionScore }) {
  const colour = scoreColour(score.score, score.maxScore);

  return (
    <li className="dimension">
      <div className="dimension__head">
        <span className="dimension__name">{score.dimensionName}</span>
        <span className="subtle dimension__weight">{score.weight}%</span>

        <span className="dimension__meter" aria-hidden>
          {Array.from({ length: score.maxScore }, (_, index) => (
            <span
              key={index}
              className="dimension__pip"
              style={{ background: index < score.score ? colour : 'var(--border)' }}
            />
          ))}
        </span>

        <span className="dimension__score" style={{ color: colour }}>
          {score.score}
          <span className="subtle dimension__score-max">/{score.maxScore}</span>
        </span>
      </div>

      {/* What this score means, taken from the problem's own rubric. */}
      <p className="dimension__band">{score.bandDescriptor}</p>

      {/* Why this submission landed there. */}
      <p className="dimension__justification">{score.justification}</p>
    </li>
  );
}
