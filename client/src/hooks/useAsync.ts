import { useCallback, useEffect, useRef, useState } from 'react';

export interface AsyncState<T> {
  readonly data: T | null;
  readonly loading: boolean;
  readonly error: unknown;
  readonly reload: () => void;
}

/**
 * Runs an async function and tracks its lifecycle.
 *
 * Small enough to justify not adding a data-fetching library for four
 * endpoints. The one subtlety it handles is discarding results from a request
 * that has been superseded - without that, navigating between problems quickly
 * can leave the earlier response overwriting the later one.
 */
export function useAsync<T>(fn: () => Promise<T>, deps: unknown[]): AsyncState<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [nonce, setNonce] = useState(0);

  const requestId = useRef(0);

  const reload = useCallback(() => setNonce((value) => value + 1), []);

  useEffect(() => {
    const id = ++requestId.current;
    let active = true;

    setLoading(true);
    setError(null);

    fn()
      .then((result) => {
        if (!active || id !== requestId.current) return;
        setData(result);
      })
      .catch((cause: unknown) => {
        if (!active || id !== requestId.current) return;
        setError(cause);
      })
      .finally(() => {
        if (!active || id !== requestId.current) return;
        setLoading(false);
      });

    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, nonce]);

  return { data, loading, error, reload };
}
