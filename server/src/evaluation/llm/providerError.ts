import { LlmClientError } from './LlmClient';

/**
 * Turns a failed provider response into an error safe to show a learner.
 *
 * The full response body is logged and deliberately not carried on the error.
 * A failure reason travels all the way to the browser, and provider error
 * bodies are not written with that in mind - OpenAI's 401 includes a masked
 * form of the configured API key, and others echo request details. None of that
 * belongs on a learner's screen, and none of it helps them.
 *
 * What they get instead is what they can act on: whether this is worth
 * retrying, or whether someone needs to fix the configuration.
 */
export async function providerError(
  response: Response,
  provider: string,
): Promise<LlmClientError> {
  let body = '';
  try {
    body = (await response.text()).slice(0, 1000);
  } catch {
    body = response.statusText;
  }

  console.error(`[llm:${provider}] HTTP ${response.status}`, body);

  return new LlmClientError(provider, learnerFacingMessage(response.status, provider));
}

function learnerFacingMessage(status: number, provider: string): string {
  if (status === 401 || status === 403) {
    return `The ${provider} evaluator rejected the request as unauthorised. The API key needs checking — retrying will not help until it is fixed.`;
  }
  if (status === 429) {
    return `The ${provider} evaluator is rate limited right now. Waiting a moment and evaluating again should work.`;
  }
  if (status >= 500) {
    return `The ${provider} evaluator is temporarily unavailable. Evaluating again usually works.`;
  }
  return `The ${provider} evaluator rejected the request (HTTP ${status}).`;
}
