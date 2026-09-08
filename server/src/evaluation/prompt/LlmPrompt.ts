/**
 * A provider-neutral prompt.
 *
 * Split into system and user parts because every provider this project might
 * use draws that line, and because it keeps the standing instructions - the
 * evidence contract, the anti-inflation rules - textually separate from the
 * learner-authored content they apply to.
 */
export interface LlmPrompt {
  readonly system: string;
  readonly user: string;
}
