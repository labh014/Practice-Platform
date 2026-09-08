import {
  DimensionScore,
  DomainError,
  type EvaluationRubric,
  FeedbackItem,
  TradeOff,
} from '../../domain';
import type { LlmClient } from '../llm/LlmClient';
import type { LlmPrompt } from '../prompt/LlmPrompt';
import type { EvaluationPromptBuilder } from '../prompt/EvaluationPromptBuilder';
import {
  type LlmEvaluationPayload,
  parseLlmEvaluationPayloadFromText,
} from '../schema/LlmEvaluationPayloadSchema';
import type { EvaluationContext } from './EvaluationContext';
import { EvaluationOutput } from './EvaluationOutput';
import { EvaluatorKind, type IEvaluator } from './IEvaluator';

/** The model's response could not be turned into a usable evaluation. */
export class EvaluationValidationError extends DomainError {
  readonly attemptsMade: number;

  constructor(message: string, attemptsMade: number) {
    super(message);
    this.attemptsMade = attemptsMade;
  }
}

/**
 * The semantic pass: judgement against the rubric.
 *
 * Everything specific to a provider lives behind LlmClient, and everything
 * specific to a problem lives in the prompt, so this class is only responsible
 * for the part that is genuinely its own - getting a structurally valid,
 * rubric-complete evaluation out of a model that may not cooperate first time.
 *
 * It does that with exactly one repair round (assumption A5). Models fail schema
 * on trivia far more often than they fail it meaningfully: a stray key, a
 * dimension scored twice, a category outside the enum. Handing the validation
 * error back once recovers most of those. Retrying further would mostly burn
 * time and tokens on a model that has misunderstood the task, and the learner is
 * better served by a FAILED attempt they can retry deliberately.
 */
export class LlmEvaluator implements IEvaluator {
  readonly name = 'llm';
  readonly kind = EvaluatorKind.SEMANTIC;

  private readonly client: LlmClient;
  private readonly promptBuilder: EvaluationPromptBuilder;

  constructor(params: { client: LlmClient; promptBuilder: EvaluationPromptBuilder }) {
    this.client = params.client;
    this.promptBuilder = params.promptBuilder;
  }

  get modelName(): string {
    return this.client.modelName;
  }

  async evaluate(context: EvaluationContext): Promise<EvaluationOutput> {
    const prompt = this.promptBuilder.build(context);
    const payload = await this.requestValidPayload(prompt, context.problem.rubric);

    return this.toOutput(payload);
  }

  private async requestValidPayload(
    prompt: LlmPrompt,
    rubric: EvaluationRubric,
  ): Promise<LlmEvaluationPayload> {
    const firstAttempt = await this.attempt(prompt, rubric);
    if (firstAttempt.ok) return firstAttempt.payload;

    const repairPrompt = this.buildRepairPrompt(prompt, firstAttempt.errorMessage);
    const secondAttempt = await this.attempt(repairPrompt, rubric);
    if (secondAttempt.ok) return secondAttempt.payload;

    throw new EvaluationValidationError(
      `The evaluator's response could not be validated after a repair attempt. ` +
        `Last error: ${secondAttempt.errorMessage}`,
      2,
    );
  }

  private async attempt(
    prompt: LlmPrompt,
    rubric: EvaluationRubric,
  ): Promise<{ ok: true; payload: LlmEvaluationPayload } | { ok: false; errorMessage: string }> {
    const raw = await this.client.complete(prompt);

    const parsed = parseLlmEvaluationPayloadFromText(raw);
    if (!parsed.ok) return parsed;

    // The schema cannot know this problem's rubric, so completeness against it
    // is checked here - and routed through the same repair path, since a missing
    // dimension is exactly the kind of omission one corrective nudge fixes.
    const rubricError = validateAgainstRubric(parsed.payload, rubric);
    if (rubricError) return { ok: false, errorMessage: rubricError };

    return { ok: true, payload: parsed.payload };
  }

  private buildRepairPrompt(original: LlmPrompt, errorMessage: string): LlmPrompt {
    return {
      system: original.system,
      user: [
        original.user,
        '',
        '---',
        '',
        '## Correction required',
        '',
        'Your previous response was rejected by schema validation:',
        '',
        errorMessage,
        '',
        'Return the corrected JSON object only. Do not explain the error, do not',
        'apologise, and do not change your assessment - only its structure.',
      ].join('\n'),
    };
  }

  private toOutput(payload: LlmEvaluationPayload): EvaluationOutput {
    return new EvaluationOutput({
      dimensionScores: payload.dimensionScores.map(
        (score) =>
          new DimensionScore({
            dimensionId: score.dimensionId,
            score: score.score,
            justification: score.justification,
          }),
      ),
      strengths: payload.strengths,
      feedback: payload.feedback.map(
        (item, index) =>
          new FeedbackItem({
            id: `fb-${index + 1}`,
            dimensionId: item.dimensionId,
            severity: item.severity,
            category: item.category,
            evidence: item.evidence,
            issue: item.issue,
            whyItMatters: item.whyItMatters,
            suggestion: item.suggestion,
            principle: item.principle,
            pattern: item.pattern,
          }),
      ),
      tradeOffs: payload.tradeOffs.map(
        (tradeOff) =>
          new TradeOff({
            decision: tradeOff.decision,
            upside: tradeOff.upside,
            downside: tradeOff.downside,
          }),
      ),
    });
  }
}

/** Checks the payload scores this problem's rubric exactly once each, with no strays. */
function validateAgainstRubric(
  payload: LlmEvaluationPayload,
  rubric: EvaluationRubric,
): string | null {
  const problems: string[] = [];
  const seen = new Set<string>();

  for (const score of payload.dimensionScores) {
    if (!rubric.has(score.dimensionId)) {
      problems.push(`dimensionScores contains unknown dimensionId "${score.dimensionId}"`);
    } else if (seen.has(score.dimensionId)) {
      problems.push(`dimensionScores scores "${score.dimensionId}" more than once`);
    }
    seen.add(score.dimensionId);
  }

  for (const dimensionId of rubric.dimensionIds) {
    if (!seen.has(dimensionId)) {
      problems.push(`dimensionScores is missing required dimensionId "${dimensionId}"`);
    }
  }

  for (const item of payload.feedback) {
    if (!rubric.has(item.dimensionId)) {
      problems.push(`feedback item references unknown dimensionId "${item.dimensionId}"`);
    }
  }

  return problems.length > 0
    ? `${problems.join('; ')}. Valid dimensionIds are: ${rubric.dimensionIds.join(', ')}.`
    : null;
}
