import { overallScoreColour, scoreColour } from '../../lib/format';
import type { AttemptSummary, Dimension } from '../../types/api';

interface ProgressTrendProps {
  attempts: AttemptSummary[];
  dimensions: Dimension[];
}

const MAX_COLUMNS = 5;

/**
 * Per-dimension scores across attempts.
 *
 * The delta panel answers "did this attempt improve on the last one". This
 * answers the longer question - which parts of your design thinking are
 * actually moving, and which have sat at 2 for three attempts running. A
 * dimension that never shifts is the most useful thing a learner can notice
 * about themselves, and it is invisible when you only ever see one attempt at a
 * time.
 *
 * Only scored attempts appear. A pending or failed attempt has no scores, and
 * showing a blank column would read as a collapse rather than an absence.
 */
export function ProgressTrend({ attempts, dimensions }: ProgressTrendProps) {
  const scored = attempts.filter(
    (attempt) => attempt.overallScore !== null && attempt.dimensionScores.length > 0,
  );

  if (scored.length < 2) return null;

  // Newest attempts win when there are more than fit; the early ones matter
  // least once a learner is several revisions in.
  const shown = scored.slice(-MAX_COLUMNS);

  return (
    <section className="pane-section">
      <h2 className="pane-section__title">Progress</h2>

      <table className="trend">
        <thead>
          <tr>
            <th className="trend__corner" scope="col">
              <span className="visually-hidden">Dimension</span>
            </th>
            {shown.map((attempt) => (
              <th key={attempt.id} className="trend__attempt mono" scope="col">
                #{attempt.attemptNumber}
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {dimensions.map((dimension) => (
            <tr key={dimension.id}>
              <th className="trend__dimension" scope="row" title={dimension.name}>
                {shortName(dimension.name)}
              </th>
              {shown.map((attempt) => {
                const score = attempt.dimensionScores.find(
                  (entry) => entry.dimensionId === dimension.id,
                )?.score;

                return (
                  <td key={attempt.id} className="trend__cell">
                    {score === undefined || score === null ? (
                      <span className="subtle" title="Not assessed">
                        –
                      </span>
                    ) : (
                      <span style={{ color: scoreColour(score) }}>{score}</span>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}

          <tr className="trend__total">
            <th className="trend__dimension" scope="row">
              Overall
            </th>
            {shown.map((attempt) => (
              <td key={attempt.id} className="trend__cell">
                <span style={{ color: overallScoreColour(attempt.overallScore ?? 0) }}>
                  {attempt.overallScore}
                </span>
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </section>
  );
}

/**
 * Dimension names are written for the scorecard, where there is room. In a
 * 380px rail the distinguishing half is what has to survive.
 */
function shortName(name: string): string {
  const [first] = name.split(' & ');
  return first ?? name;
}
