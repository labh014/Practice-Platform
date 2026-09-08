import type { LlmPrompt } from '../prompt/LlmPrompt';

/**
 * A text-in, text-out language model.
 *
 * Deliberately the smallest useful surface. The client knows how to talk to a
 * provider and nothing about rubrics, evidence or scoring - all of which live
 * in the evaluator, so swapping providers cannot change how a submission is
 * judged. That is what makes the offline mock a genuine substitute rather than
 * a different code path: it receives the same prompt the real clients do.
 *
 * Retries, schema validation and repair are the orchestrator's business, not
 * the client's. A client either returns text or throws.
 */
export interface LlmClient {
  /** Recorded on the result, so a score can always be traced to what produced it. */
  readonly modelName: string;

  complete(prompt: LlmPrompt): Promise<string>;
}

/** A provider call failed: network, auth, rate limit, timeout, or a malformed envelope. */
export class LlmClientError extends Error {
  readonly provider: string;
  override readonly cause: unknown;

  constructor(provider: string, message: string, cause?: unknown) {
    super(message);
    this.name = 'LlmClientError';
    this.provider = provider;
    this.cause = cause;
  }
}

/** Default ceiling on a single provider call. */
export const DEFAULT_LLM_TIMEOUT_MS = 60_000;

/**
 * Runs a fetch with a hard timeout.
 *
 * Without this, a hung provider connection leaves the attempt stuck in
 * EVALUATING with nothing for the learner to act on. A timeout turns that into
 * a FAILED attempt they can retry, which is recoverable.
 */
export async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number,
  provider: string,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new LlmClientError(provider, `Request timed out after ${timeoutMs}ms`, error);
    }
    throw new LlmClientError(provider, `Request failed: ${describe(error)}`, error);
  } finally {
    clearTimeout(timer);
  }
}

export function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
