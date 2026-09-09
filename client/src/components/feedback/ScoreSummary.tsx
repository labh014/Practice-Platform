import { overallScoreColour, scoreColour } from '../../lib/format';
import type { DimensionScore } from '../../types/api';

interface ScoreSummaryProps {
  overallScore: number | null;
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
 * When the evaluator declined to judge, that is shown as itself rather than as
 * a zero or a hidden row. "Not assessed" and "0/5" are different claims, and
 * the learner is entitled to know which one they received.
 */
export function ScoreSummary({
  overallScore,
  dimensionScores,
  evaluatorModel,
}: ScoreSummaryProps) {
  const assessed = overallScore !== null;

  return (
    <section className="scorecard">
      <header className="scorecard__head">
        {assessed ? (
          <div className="scorecard__overall">
            <span
              className="scorecard__overall-value"
              style={{ color: overallScoreColour(overallScore) }}
            >
              {overallScore}
            </span>
            <span className="scorecard__overall-max subtle">/100</span>
          </div>
        ) : (
          <div className="scorecard__overall">
            <span className="scorecard__unscored">Not scored</span>
          </div>
        )}

        <p className="subtle scorecard__derivation">
          {assessed ? (
            <>
              Weighted from the {dimensionScores.length} dimension scores below, not assigned
              directly. Evaluated by {evaluatorModel}.
            </>
          ) : (
            <>
              No overall score, because {evaluatorModel} declined to judge at least one
              dimension. A partial total would be a number nobody stood behind.
            </>
          )}
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
  const assessed = score.score !== null;
  const colour = assessed ? scoreColour(score.score as number, score.maxScore) : 'var(--border)';

  return (
    <li className={`dimension${assessed ? '' : ' dimension--unassessed'}`}>
      <div className="dimension__head">
        <span className="dimension__name">{score.dimensionName}</span>
        <span className="subtle dimension__weight">{score.weight}%</span>

        {assessed ? (
          <>
            <span className="dimension__meter" aria-hidden>
              {Array.from({ length: score.maxScore }, (_, index) => (
                <span
                  key={index}
                  className="dimension__pip"
                  style={{
                    background: index < (score.score as number) ? colour : 'var(--border)',
                  }}
                />
              ))}
            </span>

            <span className="dimension__score" style={{ color: colour }}>
              {score.score}
              <span className="subtle dimension__score-max">/{score.maxScore}</span>
            </span>
          </>
        ) : (
          <span className="dimension__unassessed">Not assessed</span>
        )}
      </div>

      {/* What this score means, taken from the problem's own rubric. */}
      {assessed && score.bandDescriptor ? (
        <p className="dimension__band">{score.bandDescriptor}</p>
      ) : null}

      {/* Why this submission landed there — or why nothing could be said. */}
      <p className="dimension__justification">{score.justification}</p>
    </li>
  );
}
