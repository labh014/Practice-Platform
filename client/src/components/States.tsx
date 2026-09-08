import type { ReactNode } from 'react';

import { ApiError } from '../api/client';

export function LoadingState({ label = 'Loading' }: { label?: string }) {
  return (
    <div className="state">
      <div className="spinner" aria-hidden />
      <p className="muted">{label}</p>
    </div>
  );
}

export function EmptyState({
  title,
  children,
}: {
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="state">
      <p className="state__title">{title}</p>
      {children ? <p className="muted">{children}</p> : null}
    </div>
  );
}

/**
 * Error display.
 *
 * A dead server and a rejected request are different problems with different
 * fixes, so they get different messages rather than one generic apology.
 */
export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const isApiError = error instanceof ApiError;
  const message = error instanceof Error ? error.message : String(error);

  const title = isApiError && error.isNetworkFailure ? 'Cannot reach the server' : 'Something went wrong';

  return (
    <div className="state">
      <p className="state__title">{title}</p>
      <p className="muted">{message}</p>
      {isApiError && error.isNetworkFailure ? (
        <p className="subtle mono" style={{ fontSize: 12 }}>
          npm run dev
        </p>
      ) : null}
      {onRetry ? (
        <button type="button" className="btn btn--secondary" onClick={onRetry}>
          Try again
        </button>
      ) : null}
    </div>
  );
}
