import { Link } from 'react-router-dom';

import { api } from '../api/client';
import { EmptyState, ErrorState, LoadingState } from '../components/States';
import { useAsync } from '../hooks/useAsync';
import { overallScoreColour, statusLabel } from '../lib/format';
import type { ProblemSummary } from '../types/api';
import './ProblemListPage.css';

/**
 * The catalogue.
 *
 * Its job is not to list what exists - there are two problems - but to answer
 * "what should I do next". So every card leads with the learner's own history
 * on that problem, and the call to action changes depending on whether they
 * have started, need to revise, or have something waiting to be read.
 */
export default function ProblemListPage() {
  const { data, loading, error, reload } = useAsync(() => api.listProblems(), []);

  if (loading && !data) return <LoadingState label="Loading problems" />;
  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (!data) return null;

  // Cannot happen with the seeded catalogue, but a blank page is the worst
  // possible answer to "what should I practise" if it ever does.
  if (data.length === 0) {
    return (
      <EmptyState title="No problems available">
        The server started without a problem catalogue. Restarting it should restore the
        seeded problems.
      </EmptyState>
    );
  }

  return (
    <div className="catalogue">
      <header className="catalogue__intro">
        <h1 className="catalogue__title">Practise low-level design</h1>
        <p className="catalogue__lede">
          Submit a design, get feedback grounded in what you actually wrote, then revise it
          and see whether the next attempt is genuinely better.
        </p>
      </header>

      <div className="catalogue__grid">
        {data.map((problem) => (
          <ProblemCard key={problem.id} problem={problem} />
        ))}
      </div>
    </div>
  );
}

function ProblemCard({ problem }: { problem: ProblemSummary }) {
  const started = problem.attemptCount > 0;

  return (
    <Link to={`/problems/${problem.id}`} className="problem-card card">
      <div className="problem-card__head">
        <h2 className="problem-card__title">{problem.title}</h2>
        {started ? <ProgressPill problem={problem} /> : <span className="badge problem-card__new">Not started</span>}
      </div>

      <p className="problem-card__summary muted">{problem.summary}</p>

      <div className="problem-card__foot">
        <span className="subtle">{problem.requirementCount} requirements</span>
        <span className="problem-card__cta">{callToAction(problem)}</span>
      </div>
    </Link>
  );
}

function ProgressPill({ problem }: { problem: ProblemSummary }) {
  if (problem.bestScore === null) {
    return (
      <span className="badge problem-card__pending">
        {problem.latestStatus ? statusLabel(problem.latestStatus) : 'In progress'}
      </span>
    );
  }

  return (
    <span className="problem-card__score">
      <span
        className="problem-card__score-value"
        style={{ color: overallScoreColour(problem.bestScore) }}
      >
        {problem.bestScore}
      </span>
      <span className="subtle">/100 best</span>
    </span>
  );
}

/**
 * The next action, phrased as the thing the learner would actually do.
 *
 * "Continue" tells them nothing. Whether they are starting, waiting on a
 * result, or looking at feedback they have not acted on yet are three different
 * situations, and the card should say which one they are in.
 */
function callToAction(problem: ProblemSummary): string {
  if (problem.attemptCount === 0) return 'Start practising';
  if (problem.latestStatus === 'FAILED') return 'Evaluation failed — retry';
  if (problem.latestStatus === 'SUBMITTED' || problem.latestStatus === 'EVALUATING') {
    return 'Evaluation in progress';
  }
  return `Review feedback and try again (${problem.attemptCount} ${
    problem.attemptCount === 1 ? 'attempt' : 'attempts'
  })`;
}
