/**
 * Markers the prompt builder emits, shared with anything that reads a prompt back.
 *
 * The MockLlmClient is a real LlmClient - it receives a prompt and nothing else,
 * exactly as the OpenAI and Gemini clients do - so it recovers the submission
 * and the rubric ids from the prompt text. Defining the markers here means a
 * change to either side is a compile error rather than a mock that silently
 * stops reacting to input.
 */

/** Wraps learner-authored text, which is data and never instructions. */
export const SUBMISSION_OPEN = '<<<LEARNER_SUBMISSION_BEGIN>>>';
export const SUBMISSION_CLOSE = '<<<LEARNER_SUBMISSION_END>>>';

/** Section headings inside the fenced submission block. */
export const DESIGN_SKELETON_HEADING = '### Design skeleton';
export const DESIGN_DECISIONS_HEADING = '### Design decisions';
export const ASSUMPTIONS_HEADING = '### Assumptions and edge cases';

/** How each rubric dimension announces its id. */
export function dimensionIdLine(dimensionId: string, weight: number): string {
  return `dimensionId: \`${dimensionId}\`  |  weight: ${weight}%`;
}

/** Recovers the dimension ids a prompt asked to be scored, in rubric order. */
export function extractDimensionIds(promptText: string): string[] {
  const pattern = /dimensionId: `([^`]+)`/g;
  const ids: string[] = [];

  let match = pattern.exec(promptText);
  while (match !== null) {
    const id = match[1];
    if (id) ids.push(id);
    match = pattern.exec(promptText);
  }

  return ids;
}

/** Recovers the learner's three fields from the fenced block. */
export function extractSubmissionSections(promptText: string): {
  designSkeleton: string;
  designDecisions: string;
  assumptions: string;
} {
  const start = promptText.indexOf(SUBMISSION_OPEN);
  const end = promptText.indexOf(SUBMISSION_CLOSE);

  if (start === -1 || end === -1 || end < start) {
    return { designSkeleton: '', designDecisions: '', assumptions: '' };
  }

  const block = promptText.slice(start + SUBMISSION_OPEN.length, end);

  return {
    designSkeleton: sectionOf(block, DESIGN_SKELETON_HEADING, DESIGN_DECISIONS_HEADING),
    designDecisions: sectionOf(block, DESIGN_DECISIONS_HEADING, ASSUMPTIONS_HEADING),
    assumptions: sectionOf(block, ASSUMPTIONS_HEADING, null),
  };
}

function sectionOf(block: string, heading: string, nextHeading: string | null): string {
  const start = block.indexOf(heading);
  if (start === -1) return '';

  const bodyStart = start + heading.length;
  const bodyEnd = nextHeading ? block.indexOf(nextHeading, bodyStart) : -1;

  const body = (bodyEnd === -1 ? block.slice(bodyStart) : block.slice(bodyStart, bodyEnd)).trim();

  return body === '(empty)' ? '' : body;
}
