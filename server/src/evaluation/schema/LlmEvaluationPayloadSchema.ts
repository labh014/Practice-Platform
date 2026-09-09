import { z } from 'zod';

import {
  ALL_FEEDBACK_CATEGORIES,
  type FeedbackCategory,
  MAX_DIMENSION_SCORE,
  MIN_DIMENSION_SCORE,
  Severity,
} from '../../domain';

const categoryValues = ALL_FEEDBACK_CATEGORIES as [FeedbackCategory, ...FeedbackCategory[]];
const severityValues = Object.values(Severity) as [Severity, ...Severity[]];

const DimensionScorePayloadSchema = z
  .object({
    dimensionId: z.string().min(1),
    // Null means the evaluator declined to judge this dimension. The
    // justification is still required, so an abstention has to say why.
    score: z.number().int().min(MIN_DIMENSION_SCORE).max(MAX_DIMENSION_SCORE).nullable(),
    justification: z.string().min(1),
  })
  .strict();

const FeedbackItemPayloadSchema = z
  .object({
    dimensionId: z.string().min(1),
    severity: z.enum(severityValues),
    category: z.enum(categoryValues),
    /** Must be quoted from the learner. Verified against the submission in Phase 3. */
    evidence: z.string().min(1),
    issue: z.string().min(1),
    whyItMatters: z.string().min(1),
    suggestion: z.string().min(1),
    principle: z.string().nullable().default(null),
    pattern: z.string().nullable().default(null),
  })
  .strict();

const TradeOffPayloadSchema = z
  .object({
    decision: z.string().min(1),
    upside: z.string().min(1),
    downside: z.string().min(1),
  })
  .strict();

/**
 * The exact shape the semantic evaluator is allowed to return.
 *
 * PRD 4.3 calls this EvaluationResultSchema. It is named for the payload rather
 * than the result because it is deliberately NARROWER than the domain's
 * EvaluationResult, and the difference is the point:
 *
 *   - `overallScore` is absent. It is computed from these dimension scores and
 *     the rubric weights (assumption A2). A model that returns its own headline
 *     number will eventually return 78 alongside scores of 3, 3, 2, 2, and the
 *     learner has no way to know which to believe.
 *   - `comparison` is absent. The improvement delta is arithmetic over stored
 *     history (assumption A3). A model asked to narrate its own improvement
 *     will find some.
 *
 * `.strict()` is what enforces this. Unknown keys are rejected outright, so the
 * model cannot smuggle either field back in - the constraint lives in the type
 * system rather than in a line of the prompt the model may ignore.
 */
export const LlmEvaluationPayloadSchema = z
  .object({
    dimensionScores: z.array(DimensionScorePayloadSchema).min(1),
    strengths: z.array(z.string().min(1)),
    feedback: z.array(FeedbackItemPayloadSchema),
    tradeOffs: z.array(TradeOffPayloadSchema),
  })
  .strict();

export type LlmEvaluationPayload = z.infer<typeof LlmEvaluationPayloadSchema>;
export type DimensionScorePayload = z.infer<typeof DimensionScorePayloadSchema>;
export type FeedbackItemPayload = z.infer<typeof FeedbackItemPayloadSchema>;
export type TradeOffPayload = z.infer<typeof TradeOffPayloadSchema>;

export type PayloadParseResult =
  | { readonly ok: true; readonly payload: LlmEvaluationPayload }
  | { readonly ok: false; readonly errorMessage: string };

/**
 * Validates a parsed object against the schema.
 *
 * Returns a result rather than throwing so the orchestrator can feed the
 * validation error back to the model for one repair attempt (assumption A5)
 * before giving up and failing the attempt.
 */
export function parseLlmEvaluationPayload(raw: unknown): PayloadParseResult {
  const parsed = LlmEvaluationPayloadSchema.safeParse(raw);

  if (parsed.success) {
    return { ok: true, payload: parsed.data };
  }

  return { ok: false, errorMessage: formatZodError(parsed.error) };
}

/**
 * Validates raw model text, tolerating the wrappers models habitually add.
 *
 * Models return valid JSON inside a ```json fence, or with a sentence of
 * preamble, far more often than they return genuinely malformed JSON. Failing
 * the learner's attempt over a code fence would be a self-inflicted outage, so
 * the fence is stripped before parsing. Anything still unparseable is a real
 * failure and reported as one.
 */
export function parseLlmEvaluationPayloadFromText(text: string): PayloadParseResult {
  const candidate = extractJsonObject(text);

  if (candidate === null) {
    return { ok: false, errorMessage: 'Response contained no JSON object' };
  }

  let raw: unknown;
  try {
    raw = JSON.parse(candidate);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return { ok: false, errorMessage: `Response was not valid JSON: ${detail}` };
  }

  return parseLlmEvaluationPayload(raw);
}

/** Pulls the outermost JSON object out of a response, ignoring fences and prose. */
function extractJsonObject(text: string): string | null {
  const trimmed = text.trim();

  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(trimmed);
  const body = fenced?.[1]?.trim() ?? trimmed;

  const start = body.indexOf('{');
  const end = body.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) {
    return null;
  }

  return body.slice(start, end + 1);
}

/** Flattens a Zod error into one line the model can act on during a repair retry. */
function formatZodError(error: z.ZodError): string {
  return error.issues
    .map((issue) => {
      const path = issue.path.join('.');
      return path ? `${path}: ${issue.message}` : issue.message;
    })
    .join('; ');
}
