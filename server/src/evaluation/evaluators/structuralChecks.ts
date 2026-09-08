import type { Submission } from '../../domain';

/**
 * Stable codes for deterministic findings.
 *
 * Codes rather than message matching, so tests and the UI can key off a finding
 * without depending on its wording.
 */
export const StructuralFindingCode = {
  EMPTY_SUBMISSION: 'EMPTY_SUBMISSION',
  EMPTY_DESIGN_SKELETON: 'EMPTY_DESIGN_SKELETON',
  DESIGN_SKELETON_TOO_SHORT: 'DESIGN_SKELETON_TOO_SHORT',
  NO_TYPE_DECLARATIONS: 'NO_TYPE_DECLARATIONS',
  NO_METHODS: 'NO_METHODS',
  SINGLE_TYPE_DESIGN: 'SINGLE_TYPE_DESIGN',
  THIN_DESIGN_DECISIONS: 'THIN_DESIGN_DECISIONS',
  THIN_ASSUMPTIONS: 'THIN_ASSUMPTIONS',
} as const;

export type StructuralFindingCode =
  (typeof StructuralFindingCode)[keyof typeof StructuralFindingCode];

/** A skeleton shorter than this has not described a design. */
export const MIN_DESIGN_SKELETON_LINES = 4;

/**
 * Type declarations, across the notations learners actually use.
 *
 * Submissions arrive as Java, TypeScript, Python or loose pseudocode, and often
 * a mix. The evaluator has no business insisting on one syntax, so this matches
 * the shapes all of them share. It is a signal, not a parser: a false negative
 * costs one advisory finding, never a rejected submission.
 */
const TYPE_DECLARATION_PATTERN =
  /^[ \t]*(?:(?:public|private|protected|internal|abstract|final|sealed|static|export|open|data)\s+)*(?:class|interface|enum|record|struct|trait|type|protocol)\s+([A-Za-z_$][\w$]*)/gim;

/** Method-ish lines: an identifier followed by a parameter list. */
const METHOD_PATTERN =
  /^[ \t]*(?:(?:public|private|protected|internal|static|final|abstract|override|async|def|fun|func|virtual)\s+)*(?:[\w$<>[\],.?]+\s+)?([A-Za-z_$][\w$]*)\s*\([^)]*\)/gim;

/** Words that look like methods but are control flow. */
const CONTROL_FLOW_KEYWORDS = new Set([
  'if',
  'for',
  'while',
  'switch',
  'catch',
  'return',
  'super',
  'this',
  'print',
  'println',
  'console',
  'assert',
  'with',
  'elif',
  'except',
]);

export interface SkeletonAnalysis {
  readonly typeNames: readonly string[];
  readonly methodNames: readonly string[];
  readonly nonEmptyLineCount: number;
}

/**
 * Reads whatever structure can be recovered from a design skeleton.
 *
 * Kept as a pure function so the heuristics can be tested directly, and so the
 * prompt builder can reuse the same reading of the submission that produced the
 * findings - rather than the two drifting into disagreeing about what the
 * learner wrote.
 */
export function analyseSkeleton(submission: Submission): SkeletonAnalysis {
  const text = submission.designSkeleton;

  const typeNames = unique(matchGroup(text, TYPE_DECLARATION_PATTERN));
  const declaredTypes = new Set(typeNames);

  const methodNames = unique(
    matchGroup(text, METHOD_PATTERN).filter(
      (name) =>
        !CONTROL_FLOW_KEYWORDS.has(name.toLowerCase()) &&
        // A constructor call or a type declaration is not a method definition.
        !declaredTypes.has(name),
    ),
  );

  return {
    typeNames,
    methodNames,
    nonEmptyLineCount: submission.designSkeletonLineCount,
  };
}

function matchGroup(text: string, pattern: RegExp): string[] {
  // Fresh lastIndex per call: these patterns are module-level and /g is stateful.
  const local = new RegExp(pattern.source, pattern.flags);
  const found: string[] = [];

  let match = local.exec(text);
  while (match !== null) {
    const captured = match[1];
    if (captured) found.push(captured);
    match = local.exec(text);
  }

  return found;
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values)];
}
