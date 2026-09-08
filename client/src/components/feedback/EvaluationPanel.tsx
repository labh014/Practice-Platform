import type { EvaluationResult, StructuralFinding, TradeOff } from '../../types/api';
import { FeedbackCard } from './FeedbackCard';
import { ScoreSummary } from './ScoreSummary';
import './feedback.css';

interface EvaluationPanelProps {
  result: EvaluationResult;
  structuralFindings: StructuralFinding[];
}

/**
 * The full evaluation, below the learner's design (PRD 6.1).
 *
 * The order answers the questions in the order they get asked: how did I do,
 * what worked, what is wrong, and what was a judgement call rather than a
 * mistake. Strengths come before criticism because they orient the reader, and
 * they are kept short so the section cannot turn into a compliment sandwich
 * that softens the findings underneath it.
 */
export function EvaluationPanel({ result, structuralFindings }: EvaluationPanelProps) {
  return (
    <div className="evaluation">
      <ScoreSummary
        overallScore={result.overallScore}
        dimensionScores={result.dimensionScores}
        evaluatorModel={result.evaluatorModel}
      />

      {result.strengths.length > 0 ? (
        <section className="section">
          <h3 className="section__title">What worked</h3>
          <ul className="strengths">
            {result.strengths.map((strength) => (
              <li key={strength} className="strengths__item">
                {strength}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="section">
        <h3 className="section__title">
          What to fix
          {result.feedback.length > 0 ? (
            <span className="section__count">{result.feedback.length}</span>
          ) : null}
        </h3>

        {result.feedback.length === 0 ? (
          <p className="muted section__empty">
            No specific issues were raised against your design. Look at the dimension scores
            above for where it is still short of the top band.
          </p>
        ) : (
          <div className="feedback-list">
            {result.feedback.map((item) => (
              <FeedbackCard key={item.id} item={item} />
            ))}
          </div>
        )}
      </section>

      {result.tradeOffs.length > 0 ? <TradeOffSection tradeOffs={result.tradeOffs} /> : null}

      {structuralFindings.length > 0 ? (
        <StructuralSection findings={structuralFindings} />
      ) : null}
    </div>
  );
}

/**
 * Decisions with real costs on both sides.
 *
 * Kept visually distinct from the feedback cards because these are not
 * mistakes. Low-level design has no single right answer, and an evaluation that
 * treats every judgement call as an error teaches learners to chase one house
 * style instead of learning to reason about the choice.
 */
function TradeOffSection({ tradeOffs }: { tradeOffs: TradeOff[] }) {
  return (
    <section className="section">
      <h3 className="section__title">Trade-offs you made</h3>
      <p className="subtle section__lede">
        These are judgement calls, not mistakes. Being able to argue both sides is the point.
      </p>

      <div className="tradeoffs">
        {tradeOffs.map((tradeOff) => (
          <div key={tradeOff.decision} className="tradeoff">
            <h4 className="tradeoff__decision">{tradeOff.decision}</h4>
            <div className="tradeoff__sides">
              <div className="tradeoff__side">
                <span className="tradeoff__label tradeoff__label--up">Buys you</span>
                <p className="tradeoff__text">{tradeOff.upside}</p>
              </div>
              <div className="tradeoff__side">
                <span className="tradeoff__label tradeoff__label--down">Costs you</span>
                <p className="tradeoff__text">{tradeOff.downside}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

/**
 * The deterministic observations.
 *
 * Shown last and played down: these are measurements of the submission rather
 * than judgements about the design. Labelling their source matters, because a
 * learner should be able to tell an automated count from an opinion about their
 * abstractions.
 */
function StructuralSection({ findings }: { findings: StructuralFinding[] }) {
  return (
    <section className="section">
      <h3 className="section__title">Automated checks</h3>
      <p className="subtle section__lede">
        Objective observations about the submission itself, not judgements about the design.
      </p>

      <ul className="structural">
        {findings.map((finding) => (
          <li key={finding.code} className="structural__item">
            <span className="structural__message">{finding.message}</span>
            {finding.detail ? (
              <span className="subtle structural__detail"> {finding.detail}</span>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
