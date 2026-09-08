import type { LlmPrompt } from '../prompt/LlmPrompt';
import {
  DEFAULT_LLM_TIMEOUT_MS,
  fetchWithTimeout,
  type LlmClient,
  LlmClientError,
  describe,
} from './LlmClient';

const ENDPOINT = 'https://api.openai.com/v1/chat/completions';
const PROVIDER = 'openai';

interface OpenAiResponse {
  choices?: Array<{ message?: { content?: string | null } }>;
  error?: { message?: string };
}

/**
 * OpenAI chat completions, as specified by the execution plan.
 *
 * Uses the platform fetch rather than the SDK: one HTTP call against a stable
 * endpoint does not justify a dependency, and it keeps the two provider clients
 * structurally identical and equally easy to read.
 *
 * Temperature is pinned to 0. Practice only means something if the same design
 * scores the same way twice - a learner who resubmits identical work and sees a
 * different number has been given a reason to distrust the whole review.
 * Determinism here is a product requirement, not a tuning preference.
 */
export class OpenAiLlmClient implements LlmClient {
  readonly modelName: string;

  private readonly apiKey: string;
  private readonly timeoutMs: number;

  constructor(params: { apiKey: string; model?: string; timeoutMs?: number }) {
    if (!params.apiKey.trim()) {
      throw new LlmClientError(PROVIDER, 'An API key is required');
    }

    this.apiKey = params.apiKey;
    this.modelName = params.model ?? 'gpt-4o-mini';
    this.timeoutMs = params.timeoutMs ?? DEFAULT_LLM_TIMEOUT_MS;
  }

  async complete(prompt: LlmPrompt): Promise<string> {
    const response = await fetchWithTimeout(
      ENDPOINT,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.modelName,
          temperature: 0,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: prompt.system },
            { role: 'user', content: prompt.user },
          ],
        }),
      },
      this.timeoutMs,
      PROVIDER,
    );

    if (!response.ok) {
      throw new LlmClientError(
        PROVIDER,
        `HTTP ${response.status}: ${await safeErrorText(response)}`,
      );
    }

    let body: OpenAiResponse;
    try {
      body = (await response.json()) as OpenAiResponse;
    } catch (error) {
      throw new LlmClientError(PROVIDER, `Response was not JSON: ${describe(error)}`, error);
    }

    if (body.error?.message) {
      throw new LlmClientError(PROVIDER, body.error.message);
    }

    const content = body.choices?.[0]?.message?.content;
    if (!content) {
      throw new LlmClientError(PROVIDER, 'Response contained no message content');
    }

    return content;
  }
}

async function safeErrorText(response: Response): Promise<string> {
  try {
    return (await response.text()).slice(0, 500);
  } catch {
    return response.statusText;
  }
}
