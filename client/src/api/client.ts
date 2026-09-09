import type {
  Attempt,
  AttemptSummary,
  Problem,
  ProblemSummary,
  SubmitAttemptRequest,
  SubmitAttemptResponse,
} from '../types/api';

/** Authentication is out of scope; the learner id is fixed. */
export const USER_ID = 'learner_1';

const BASE = '/api';

/** A structured failure from the API, carrying enough to render a useful message. */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: unknown;

  constructor(params: { status: number; code: string; message: string; details?: unknown }) {
    super(params.message);
    this.name = 'ApiError';
    this.status = params.status;
    this.code = params.code;
    this.details = params.details;
  }

  /** True when the server is unreachable rather than refusing the request. */
  get isNetworkFailure(): boolean {
    return this.status === 0;
  }
}

interface ApiErrorBody {
  error?: { code?: string; message?: string; details?: unknown };
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;

  try {
    response = await fetch(`${BASE}${path}`, {
      headers: { 'Content-Type': 'application/json' },
      ...init,
    });
  } catch (cause) {
    // A dead server and a rejected request need different messages: one is
    // "start the API", the other is "fix the request".
    throw new ApiError({
      status: 0,
      code: 'NETWORK_ERROR',
      message: 'Could not reach the server. Is it running on port 4000?',
      details: cause,
    });
  }

  if (!response.ok) {
    let body: ApiErrorBody = {};
    try {
      body = (await response.json()) as ApiErrorBody;
    } catch {
      // Non-JSON error body; the status alone will have to do.
    }

    throw new ApiError({
      status: response.status,
      code: body.error?.code ?? 'UNKNOWN',
      message: body.error?.message ?? `Request failed with status ${response.status}`,
      details: body.error?.details,
    });
  }

  return (await response.json()) as T;
}

export interface HealthResponse {
  status: string;
  evaluator: { name: string; isOffline: boolean };
}

export const api = {
  getHealth(): Promise<HealthResponse> {
    return request('/health');
  },

  listProblems(): Promise<ProblemSummary[]> {
    return request(`/problems?userId=${encodeURIComponent(USER_ID)}`);
  },

  getProblem(problemId: string): Promise<Problem> {
    return request(
      `/problems/${encodeURIComponent(problemId)}?userId=${encodeURIComponent(USER_ID)}`,
    );
  },

  listAttempts(problemId: string): Promise<AttemptSummary[]> {
    return request(
      `/problems/${encodeURIComponent(problemId)}/attempts?userId=${encodeURIComponent(USER_ID)}`,
    );
  },

  getAttempt(attemptId: string): Promise<Attempt> {
    return request(`/attempts/${encodeURIComponent(attemptId)}`);
  },

  submitAttempt(body: SubmitAttemptRequest): Promise<SubmitAttemptResponse> {
    return request('/attempts', {
      method: 'POST',
      body: JSON.stringify({ userId: USER_ID, ...body }),
    });
  },

  retryAttempt(attemptId: string): Promise<SubmitAttemptResponse> {
    return request(`/attempts/${encodeURIComponent(attemptId)}/retry`, { method: 'POST' });
  },
};
