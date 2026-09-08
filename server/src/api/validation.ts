import { z } from 'zod';

import { DEFAULT_USER_ID } from '../domain';

/** Generous enough for a real design, bounded enough to reject a paste bomb. */
const MAX_FIELD_LENGTH = 20_000;

const submissionField = z.string().max(MAX_FIELD_LENGTH);

/**
 * The submit request.
 *
 * Every field permits an empty string. PRD 7.1 requires an empty submission to
 * produce structural signals and PRD 4.1 forbids those signals from
 * short-circuiting the evaluator, so emptiness is something the platform
 * evaluates and reports on rather than something it refuses at the door. A
 * learner who submits nothing gets a scored explanation of why nothing scores
 * nothing, which teaches more than a 400 does.
 */
export const SubmitAttemptRequestSchema = z
  .object({
    // required_error covers a missing key; .min(1) covers an empty one. Without
    // both, omitting the field yields Zod's bare "Required" and the client has
    // to guess which field it meant.
    problemId: z
      .string({ required_error: 'problemId is required' })
      .min(1, 'problemId is required'),
    userId: z.string().min(1).default(DEFAULT_USER_ID),
    designSkeleton: submissionField.default(''),
    designDecisions: submissionField.default(''),
    assumptions: submissionField.default(''),
  })
  .strict();

export type SubmitAttemptRequest = z.infer<typeof SubmitAttemptRequestSchema>;

/** Authentication is out of scope, so the learner id is a parameter with a default. */
export const UserQuerySchema = z.object({
  userId: z.string().min(1).default(DEFAULT_USER_ID),
});

export type ValidationResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly issues: readonly string[] };

/**
 * Generic over the schema rather than over one payload type.
 *
 * A schema with `.default()` has a different input type from its output type -
 * the field is optional going in and guaranteed coming out. Collapsing both
 * into a single parameter makes TypeScript infer the input side, and every
 * defaulted field arrives at the service still typed as possibly undefined.
 */
export function validate<S extends z.ZodTypeAny>(
  schema: S,
  input: unknown,
): ValidationResult<z.output<S>> {
  const parsed = schema.safeParse(input);

  if (parsed.success) {
    return { ok: true, value: parsed.data };
  }

  return {
    ok: false,
    issues: parsed.error.issues.map((issue) => {
      const path = issue.path.join('.');
      return path ? `${path}: ${issue.message}` : issue.message;
    }),
  };
}
