import { useParams } from 'react-router-dom';

import { api } from '../api/client';
import { ErrorState, LoadingState } from '../components/States';
import { useAsync } from '../hooks/useAsync';

/**
 * The practice workspace.
 *
 * Phase 7 establishes the route and proves the problem loads on a cold page
 * refresh. Phase 8 replaces this with the dual-pane layout: requirements and
 * history on the left, the three editors on the right.
 */
export default function WorkspacePage() {
  const { problemId = '' } = useParams();

  const { data: problem, loading, error, reload } = useAsync(
    () => api.getProblem(problemId),
    [problemId],
  );

  if (loading && !problem) return <LoadingState label="Loading problem" />;
  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (!problem) return null;

  return (
    <div style={{ maxWidth: 880, margin: '0 auto', padding: '48px 24px' }}>
      <h1 style={{ fontSize: 22 }}>{problem.title}</h1>
      <p className="muted" style={{ marginTop: 8 }}>
        {problem.summary}
      </p>

      <p className="subtle" style={{ marginTop: 32, fontSize: 12.5 }}>
        {problem.requirements.length} requirements · {problem.dimensions.length} rubric
        dimensions
        {problem.changeScenario ? ` · change scenario unlocked` : ''}
      </p>
    </div>
  );
}
