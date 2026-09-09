import { GeminiLlmClient } from './GeminiLlmClient';
import type { LlmClient } from './LlmClient';
import { MockLlmClient } from './MockLlmClient';
import { OpenAiLlmClient } from './OpenAiLlmClient';

export const LlmProvider = {
  MOCK: 'mock',
  GEMINI: 'gemini',
  OPENAI: 'openai',
} as const;

export type LlmProvider = (typeof LlmProvider)[keyof typeof LlmProvider];

export interface LlmClientSelection {
  readonly client: LlmClient;
  /** What actually happened, for the startup banner. */
  readonly notice: string;
}

/**
 * Chooses an LLM client from the environment.
 *
 * The rule is that the server always starts. A missing or misconfigured key
 * downgrades to the mock with a loud notice rather than refusing to boot,
 * because the alternative is a platform that is unusable in exactly the
 * situation it most needs to work: a fresh clone with no credentials.
 *
 * The mock is therefore the default rather than a degraded mode, and every
 * other provider is an upgrade the operator opts into.
 */
export function createLlmClient(env: NodeJS.ProcessEnv = process.env): LlmClientSelection {
  const requested = (env['LLM_PROVIDER'] ?? LlmProvider.MOCK).trim().toLowerCase();

  switch (requested) {
    case LlmProvider.OPENAI: {
      const apiKey = env['OPENAI_API_KEY']?.trim();
      if (!apiKey) {
        return fallback('LLM_PROVIDER=openai but OPENAI_API_KEY is not set');
      }
      const model = env['OPENAI_MODEL']?.trim();
      const timeoutMs = timeoutFrom(env);
      return {
        client: new OpenAiLlmClient({ apiKey, ...(model && { model }), ...(timeoutMs && { timeoutMs }) }),
        notice: `Semantic evaluation: OpenAI (${model ?? 'gpt-4o-mini'}).`,
      };
    }

    case LlmProvider.GEMINI: {
      const apiKey = env['GEMINI_API_KEY']?.trim();
      if (!apiKey) {
        return fallback('LLM_PROVIDER=gemini but GEMINI_API_KEY is not set');
      }
      const model = env['GEMINI_MODEL']?.trim();
      const timeoutMs = timeoutFrom(env);
      return {
        client: new GeminiLlmClient({ apiKey, ...(model && { model }), ...(timeoutMs && { timeoutMs }) }),
        notice: `Semantic evaluation: Gemini (${model ?? 'gemini-3.6-flash'}).`,
      };
    }

    case LlmProvider.MOCK:
      return {
        client: new MockLlmClient({ latencyMs: mockLatency(env) }),
        notice: 'Semantic evaluation: offline mock. No API key needed, no cost.',
      };

    default:
      return fallback(`Unknown LLM_PROVIDER "${requested}"`);
  }
}

/**
 * Per-call timeout, in milliseconds.
 *
 * Configurable because model latency varies by more than the default allows.
 * A reasoning-heavy model can sit close to a minute on a full rubric prompt,
 * and needing a code edit to accommodate that would be the wrong shape of
 * problem - the operator picking the model should be able to pick its budget.
 */
function timeoutFrom(env: NodeJS.ProcessEnv): number | undefined {
  const raw = Number(env['LLM_TIMEOUT_MS']);
  return Number.isFinite(raw) && raw > 0 ? raw : undefined;
}

function fallback(reason: string): LlmClientSelection {
  return {
    client: new MockLlmClient({ latencyMs: mockLatency(process.env) }),
    notice: `${reason}. Falling back to the offline mock evaluator.`,
  };
}

/**
 * A short pause so the EVALUATING state is visible while demonstrating the app.
 *
 * Zero under test, where it would only slow the suite down.
 */
function mockLatency(env: NodeJS.ProcessEnv): number {
  if (env['NODE_ENV'] === 'test') return 0;
  return Number(env['MOCK_LLM_LATENCY_MS'] ?? 700);
}
