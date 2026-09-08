import type { LlmPrompt } from '../prompt/LlmPrompt';
import {
  DEFAULT_LLM_TIMEOUT_MS,
  fetchWithTimeout,
  type LlmClient,
  LlmClientError,
  describe,
} from './LlmClient';

const PROVIDER = 'gemini';

interface GeminiResponse {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
    finishReason?: string;
  }>;
  error?: { message?: string };
}

/**
 * Google Gemini.
 *
 * Present because the execution plan's OpenAI client is the project's only
 * paid dependency, and a learner platform whose evaluation cannot be
 * demonstrated without a credit card is a platform that cannot be demonstrated.
 * Gemini's free tier needs no card, so the same evidence-backed evaluation runs
 * at zero cost.
 *
 * Sits behind the same LlmClient interface as OpenAI and the mock, so choosing
 * between them is one environment variable and changes nothing about how a
 * submission is judged.
 */
export class GeminiLlmClient implements LlmClient {
  readonly modelName: string;

  private readonly apiKey: string;
  private readonly timeoutMs: number;

  constructor(params: { apiKey: string; model?: string; timeoutMs?: number }) {
    if (!params.apiKey.trim()) {
      throw new LlmClientError(PROVIDER, 'An API key is required');
    }

    this.apiKey = params.apiKey;
    this.modelName = params.model ?? 'gemini-2.0-flash';
    this.timeoutMs = params.timeoutMs ?? DEFAULT_LLM_TIMEOUT_MS;
  }

  async complete(prompt: LlmPrompt): Promise<string> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
      this.modelName,
    )}:generateContent`;

    const response = await fetchWithTimeout(
      url,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // Header rather than a query parameter, so the key stays out of logs.
          'x-goog-api-key': this.apiKey,
        },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: prompt.system }] },
          contents: [{ role: 'user', parts: [{ text: prompt.user }] }],
          generationConfig: {
            temperature: 0,
            responseMimeType: 'application/json',
          },
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

    let body: GeminiResponse;
    try {
      body = (await response.json()) as GeminiResponse;
    } catch (error) {
      throw new LlmClientError(PROVIDER, `Response was not JSON: ${describe(error)}`, error);
    }

    if (body.error?.message) {
      throw new LlmClientError(PROVIDER, body.error.message);
    }

    const candidate = body.candidates?.[0];
    const text = candidate?.content?.parts?.map((part) => part.text ?? '').join('') ?? '';

    if (!text.trim()) {
      // A truncated or filtered response is reported as itself rather than as
      // malformed JSON, so a failed attempt says something the learner can act on.
      const reason = candidate?.finishReason ?? 'unknown';
      throw new LlmClientError(PROVIDER, `Response contained no text (finishReason: ${reason})`);
    }

    return text;
  }
}

async function safeErrorText(response: Response): Promise<string> {
  try {
    return (await response.text()).slice(0, 500);
  } catch {
    return response.statusText;
  }
}
