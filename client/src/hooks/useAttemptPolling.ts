import { useEffect, useRef, useState } from 'react';

import { api } from '../api/client';
import { isPendingStatus } from '../lib/format';
import type { Attempt } from '../types/api';

const POLL_INTERVAL_MS = 1200;
/** Roughly two minutes. Past this, something is wrong and saying so beats spinning. */
const MAX_POLLS = 100;

export interface AttemptPolling {
  readonly attempt: Attempt | null;
  readonly loading: boolean;
  readonly error: unknown;
  readonly timedOut: boolean;
  readonly refresh: () => void;
}

/**
 * Loads an attempt and keeps polling while its evaluation is in flight.
 *
 * Polling stops the moment the attempt reaches COMPLETED or FAILED, so a
 * settled attempt costs nothing. The poll cap exists because an attempt that
 * never settles is a bug, and spinning forever hides it from both the learner
 * and whoever has to debug it - better to stop and say the evaluation is taking
 * longer than expected.
 */
export function useAttemptPolling(attemptId: string | null): AttemptPolling {
  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [timedOut, setTimedOut] = useState(false);
  const [nonce, setNonce] = useState(0);

  const pollCount = useRef(0);

  useEffect(() => {
    if (!attemptId) {
      setAttempt(null);
      setLoading(false);
      setError(null);
      setTimedOut(false);
      return;
    }

    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;

    pollCount.current = 0;
    setLoading(true);
    setError(null);
    setTimedOut(false);

    const tick = async (): Promise<void> => {
      try {
        const next = await api.getAttempt(attemptId);
        if (!active) return;

        setAttempt(next);
        setLoading(false);

        if (!isPendingStatus(next.status)) return;

        pollCount.current += 1;
        if (pollCount.current >= MAX_POLLS) {
          setTimedOut(true);
          return;
        }

        timer = setTimeout(() => void tick(), POLL_INTERVAL_MS);
      } catch (cause) {
        if (!active) return;
        setError(cause);
        setLoading(false);
      }
    };

    void tick();

    return () => {
      active = false;
      if (timer) clearTimeout(timer);
    };
  }, [attemptId, nonce]);

  return {
    attempt,
    loading,
    error,
    timedOut,
    refresh: () => setNonce((value) => value + 1),
  };
}
