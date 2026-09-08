import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';

import { ApiError, api } from '../api/client';
import { ErrorState, LoadingState } from '../components/States';
import { AttemptView } from '../components/workspace/AttemptView';
import { ProblemPane } from '../components/workspace/ProblemPane';
import { SubmissionEditor } from '../components/workspace/SubmissionEditor';
import { useAsync } from '../hooks/useAsync';
import { useAttemptPolling } from '../hooks/useAttemptPolling';
import { hasStoredDraft, useDraft } from '../hooks/useDraft';
import { isPendingStatus } from '../lib/format';
import type { AttemptSummary, Submission } from '../types/api';
import './WorkspacePage.css';

/**
 * The practice workspace.
 *
 * Two panes, both always visible: the problem and the learner's history on the
 * left, their work on the right. The right pane is in one of two modes -
 * drafting a new attempt, or looking at a submitted one - and the mode is
 * decided by whether an attempt is selected.
 *
 * On arrival the most recent attempt is selected rather than a blank editor,
 * because a returning learner's next question is almost always "what did it say
 * last time", not "let me start over".
 */
export default function WorkspacePage() {
  const { problemId = '' } = useParams();

  const problemState = useAsync(() => api.getProblem(problemId), [problemId]);
  const [attempts, setAttempts] = useState<AttemptSummary[]>([]);
  const [attemptsLoaded, setAttemptsLoaded] = useState(false);

  const [selectedAttemptId, setSelectedAttemptId] = useState<string | null>(null);
  const [isDrafting, setIsDrafting] = useState(false);
  const [revisingFrom, setRevisingFrom] = useState<number | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const { draft, setField, replace, clear } = useDraft(problemId);
  const polling = useAttemptPolling(isDrafting ? null : selectedAttemptId);

  const refreshAttempts = useCallback(async (): Promise<AttemptSummary[]> => {
    const next = await api.listAttempts(problemId);
    setAttempts(next);
    return next;
  }, [problemId]);

  // Initial history load. Selecting the latest attempt only happens here, so a
  // learner who has deliberately opened an older one is not yanked away from it.
  useEffect(() => {
    let active = true;
    setAttemptsLoaded(false);

    void api
      .listAttempts(problemId)
      .then((loaded) => {
        if (!active) return;
        setAttempts(loaded);
        setSelectedAttemptId(loaded.at(-1)?.id ?? null);

        // An unfinished draft wins over the last attempt. Someone who was
        // mid-revision when the tab closed should land back in their editor;
        // dropping them on old feedback makes it look like the work is gone.
        setIsDrafting(loaded.length === 0 || hasStoredDraft(problemId));
        setAttemptsLoaded(true);
      })
      .catch(() => {
        if (!active) return;
        setAttemptsLoaded(true);
      });

    return () => {
      active = false;
    };
  }, [problemId]);

  /**
   * The problem is re-fetched once an attempt settles, because the change
   * scenario unlocks on attempt count. Without this the learner would have to
   * reload the page to see the scenario their first attempt just earned them.
   */
  useEffect(() => {
    if (polling.attempt && !isPendingStatus(polling.attempt.status)) {
      void refreshAttempts();
      problemState.reload();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [polling.attempt?.id, polling.attempt?.status]);

  const startNewAttempt = useCallback(
    (prefillFrom?: { submission: Submission; attemptNumber: number }) => {
      if (prefillFrom) {
        // Revision starts from what they wrote, never from a blank page. Asking
        // someone to retype a design in order to change one class is how a
        // practice loop turns into a chore.
        replace({ ...prefillFrom.submission });
        setRevisingFrom(prefillFrom.attemptNumber);
      } else {
        setRevisingFrom(null);
      }

      setIsDrafting(true);
      setSubmitError(null);
    },
    [replace],
  );

  const handleSubmit = useCallback(async () => {
    setSubmitting(true);
    setSubmitError(null);

    try {
      const response = await api.submitAttempt({ problemId, ...draft });

      clear();
      setIsDrafting(false);
      setRevisingFrom(null);
      setSelectedAttemptId(response.attemptId);
      await refreshAttempts();
    } catch (error) {
      setSubmitError(
        error instanceof ApiError ? error.message : 'Could not submit. Please try again.',
      );
    } finally {
      setSubmitting(false);
    }
  }, [problemId, draft, clear, refreshAttempts]);

  const handleRetryEvaluation = useCallback(async () => {
    if (!selectedAttemptId) return;

    setRetrying(true);
    try {
      await api.retryAttempt(selectedAttemptId);
      polling.refresh();
    } catch {
      // The attempt stays FAILED and retryable; the button can be pressed again.
    } finally {
      setRetrying(false);
    }
  }, [selectedAttemptId, polling]);

  if (problemState.loading && !problemState.data) return <LoadingState label="Loading problem" />;
  if (problemState.error) {
    return <ErrorState error={problemState.error} onRetry={problemState.reload} />;
  }
  if (!problemState.data || !attemptsLoaded) return <LoadingState label="Loading problem" />;

  const problem = problemState.data;
  const nextAttemptNumber = (attempts.at(-1)?.attemptNumber ?? 0) + 1;

  return (
    <div className="workspace">
      <ProblemPane
        problem={problem}
        attempts={attempts}
        selectedAttemptId={selectedAttemptId}
        isDrafting={isDrafting}
        onSelectAttempt={(attemptId) => {
          setSelectedAttemptId(attemptId);
          setIsDrafting(false);
        }}
        onStartNewAttempt={() => startNewAttempt()}
      />

      <section className="pane pane--right">
        <div className="pane__scroll">
          {isDrafting || !selectedAttemptId ? (
            <SubmissionEditor
              draft={draft}
              attemptNumber={nextAttemptNumber}
              revisingFrom={revisingFrom}
              submitting={submitting}
              error={submitError}
              onChange={setField}
              onSubmit={() => void handleSubmit()}
              onDiscard={
                attempts.length > 0
                  ? () => {
                      setIsDrafting(false);
                      setRevisingFrom(null);
                    }
                  : null
              }
            />
          ) : polling.error ? (
            <ErrorState error={polling.error} onRetry={polling.refresh} />
          ) : polling.attempt ? (
            <AttemptView
              attempt={polling.attempt}
              problem={problem}
              timedOut={polling.timedOut}
              retrying={retrying}
              onRetry={() => void handleRetryEvaluation()}
              onTryAgain={() =>
                startNewAttempt({
                  submission: polling.attempt!.submission,
                  attemptNumber: polling.attempt!.attemptNumber,
                })
              }
            />
          ) : (
            <LoadingState label="Loading attempt" />
          )}
        </div>
      </section>
    </div>
  );
}
