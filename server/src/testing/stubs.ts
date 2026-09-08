import type { LlmClient } from '../evaluation/llm/LlmClient';
import type { LlmPrompt } from '../evaluation/prompt/LlmPrompt';

/**
 * An LlmClient returning scripted responses.
 *
 * Lets tests drive the failure paths - malformed JSON, a missing rubric
 * dimension, a fabricated evidence snippet - which the MockLlmClient will never
 * produce because it is deliberately well behaved. Records the prompts it
 * received so the repair round-trip can be asserted on directly.
 */
export class StubLlmClient implements LlmClient {
  readonly modelName = 'stub';
  readonly promptsReceived: LlmPrompt[] = [];

  private readonly responses: string[];

  constructor(responses: string[]) {
    this.responses = [...responses];
  }

  // eslint-disable-next-line @typescript-eslint/require-await -- satisfies the async contract
  async complete(prompt: LlmPrompt): Promise<string> {
    this.promptsReceived.push(prompt);
    return this.responses.shift() ?? '{}';
  }

  get callCount(): number {
    return this.promptsReceived.length;
  }
}

/** An LlmClient that always throws, standing in for a provider outage. */
export class FailingLlmClient implements LlmClient {
  readonly modelName = 'failing';

  constructor(private readonly message = 'Provider unavailable') {}

  // eslint-disable-next-line @typescript-eslint/require-await -- satisfies the async contract
  async complete(): Promise<string> {
    throw new Error(this.message);
  }
}
