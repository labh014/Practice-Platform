import { overallScoreColour, statusLabel } from '../../lib/format';
import type { AttemptSummary, ChangeScenario, Problem, Requirement } from '../../types/api';

interface ProblemPaneProps {
  problem: Problem;
  attempts: AttemptSummary[];
  selectedAttemptId: string | null;
  onSelectAttempt: (attemptId: string) => void;
  onStartNewAttempt: () => void;
  isDrafting: boolean;
}

/**
 * The left pane: what the problem asks, and what the learner has already done
 * about it.
 *
 * It stays on screen while they work and while they read feedback, because both
 * activities are a comparison against the requirements. Making them navigate
 * away to re-read R4 would be asking them to hold it in their head instead.
 */
export function ProblemPane({
  problem,
  attempts,
  selectedAttemptId,
  onSelectAttempt,
  onStartNewAttempt,
  isDrafting,
}: ProblemPaneProps) {
  return (
    <aside className="pane pane--left">
      <div className="pane__scroll">
        <section className="brief">
          <h1 className="brief__title">{problem.title}</h1>
          <p className="brief__description">{problem.description}</p>
        </section>

        <RequirementSection requirements={problem.requirements} />

        {problem.changeScenario ? (
          <ChangeScenarioSection
            scenario={problem.changeScenario}
            active={problem.changeScenarioActive}
            dimensionName={
              problem.dimensions.find((d) => d.id === problem.changeScenario?.probesDimensionId)
                ?.name ?? 'Extensibility'
            }
          />
        ) : null}

        <AttemptRail
          attempts={attempts}
          selectedAttemptId={selectedAttemptId}
          onSelect={onSelectAttempt}
          onStartNew={onStartNewAttempt}
          isDrafting={isDrafting}
        />
      </div>
    </aside>
  );
}

function RequirementSection({ requirements }: { requirements: Requirement[] }) {
  return (
    <section className="pane-section">
      <h2 className="pane-section__title">Requirements</h2>
      <ul className="requirements">
        {requirements.map((requirement) => (
          <RequirementRow key={requirement.id} requirement={requirement} />
        ))}
      </ul>
    </section>
  );
}

function RequirementRow({ requirement }: { requirement: Requirement }) {
  return (
    <li className="requirement">
      <div className="requirement__head">
        <span className="requirement__id mono">{requirement.id}</span>
        <span className={`badge requirement__importance requirement__importance--${requirement.importance.toLowerCase()}`}>
          {requirement.importance}
        </span>
      </div>
      <p className="requirement__text">{requirement.text}</p>
    </li>
  );
}

/**
 * The change scenario, once unlocked.
 *
 * Framed as a probe of one named dimension rather than as an extra requirement,
 * and labelled as such. A learner who reads this as "also build EV charging"
 * would be answering a different question from the one being scored - and the
 * scoring, which routes it to Extensibility alone, would look arbitrary to them.
 */
function ChangeScenarioSection({
  scenario,
  active,
  dimensionName,
}: {
  scenario: ChangeScenario;
  active: boolean;
  dimensionName: string;
}) {
  return (
    <section className="pane-section">
      <h2 className="pane-section__title">
        Change scenario
        {active ? <span className="pane-section__flag">Now in play</span> : null}
      </h2>

      <div className="scenario">
        <h3 className="scenario__title">{scenario.title}</h3>
        <p className="scenario__body">{scenario.description}</p>
        <p className="scenario__note">
          This is not an extra requirement — you are not being asked to build it. It informs
          your <strong>{dimensionName}</strong> score only.
        </p>
      </div>
    </section>
  );
}

function AttemptRail({
  attempts,
  selectedAttemptId,
  onSelect,
  onStartNew,
  isDrafting,
}: {
  attempts: AttemptSummary[];
  selectedAttemptId: string | null;
  onSelect: (attemptId: string) => void;
  onStartNew: () => void;
  isDrafting: boolean;
}) {
  return (
    <section className="pane-section">
      <h2 className="pane-section__title">
        Attempts
        {attempts.length > 0 ? <span className="pane-section__count">{attempts.length}</span> : null}
      </h2>

      {attempts.length === 0 ? (
        <p className="subtle attempt-rail__empty">
          Your attempts will appear here, so you can compare them.
        </p>
      ) : (
        <ul className="attempt-rail">
          {[...attempts].reverse().map((attempt) => (
            <li key={attempt.id}>
              <button
                type="button"
                className={`attempt-chip${
                  attempt.id === selectedAttemptId && !isDrafting ? ' attempt-chip--active' : ''
                }`}
                onClick={() => onSelect(attempt.id)}
              >
                <span className="attempt-chip__number mono">#{attempt.attemptNumber}</span>

                {attempt.overallScore !== null ? (
                  <span
                    className="attempt-chip__score"
                    style={{ color: overallScoreColour(attempt.overallScore) }}
                  >
                    {attempt.overallScore}
                  </span>
                ) : (
                  <span className="attempt-chip__status subtle">
                    {statusLabel(attempt.status)}
                  </span>
                )}

                {attempt.openIssueCount > 0 ? (
                  <span className="attempt-chip__issues subtle">
                    {attempt.openIssueCount} to fix
                  </span>
                ) : null}
              </button>
            </li>
          ))}
        </ul>
      )}

      {attempts.length > 0 ? (
        <button
          type="button"
          className={`btn btn--secondary attempt-rail__new${isDrafting ? ' attempt-rail__new--active' : ''}`}
          onClick={onStartNew}
        >
          {isDrafting ? 'Editing new attempt' : 'Start a new attempt'}
        </button>
      ) : null}
    </section>
  );
}
