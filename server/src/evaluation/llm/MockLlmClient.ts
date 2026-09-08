import { FeedbackCategory, MAX_DIMENSION_SCORE, Severity } from '../../domain';
import type { LlmPrompt } from '../prompt/LlmPrompt';
import { extractDimensionIds, extractSubmissionSections } from '../prompt/promptMarkers';
import type {
  FeedbackItemPayload,
  LlmEvaluationPayload,
  TradeOffPayload,
} from '../schema/LlmEvaluationPayloadSchema';
import type { LlmClient } from './LlmClient';

/**
 * The offline evaluator.
 *
 * This is not a stub that returns a canned blob. It reads the submission out of
 * the prompt and applies a set of rules over what the learner actually wrote, so
 * a God class and a well-separated design produce visibly different reviews,
 * with evidence quoted from the real text.
 *
 * That matters for two reasons. It is the only evaluator the test suite ever
 * uses (PRD 7.5), and a static mock would let every downstream assertion pass
 * without proving anything. And it is what the platform falls back to when no
 * API key is configured, so the complete learner loop - submit, evaluate,
 * revise, compare - has to work at zero cost and with no network.
 *
 * Its limits are real and worth stating plainly: these are pattern rules, not
 * comprehension. They recognise the failure modes the seeded problems are built
 * around and will miss a novel design's subtler mistakes. That is the honest
 * trade for an evaluator that always works, and it is why the scores it awards
 * are deliberately conservative rather than generous.
 */
export class MockLlmClient implements LlmClient {
  readonly modelName = 'mock';

  /**
   * Artificial delay before responding.
   *
   * Zero in tests. A few hundred milliseconds in dev makes the EVALUATING state
   * observable in the UI, which is otherwise invisible when the mock answers in
   * under a millisecond. It buys nothing but a realistic demo, and it is opt-in
   * so it can never slow the suite.
   */
  private readonly latencyMs: number;

  constructor(options?: { latencyMs?: number }) {
    this.latencyMs = options?.latencyMs ?? 0;
  }

  async complete(prompt: LlmPrompt): Promise<string> {
    if (this.latencyMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, this.latencyMs));
    }

    return JSON.stringify(this.buildPayload(prompt), null, 2);
  }

  /** Exposed for tests, which assert on the payload rather than on JSON text. */
  buildPayload(prompt: LlmPrompt): LlmEvaluationPayload {
    const sections = extractSubmissionSections(prompt.user);
    const dimensions = resolveDimensions(extractDimensionIds(prompt.user));
    const reading = readSubmission(sections);

    if (reading.isEmpty) {
      return emptySubmissionPayload(dimensions);
    }

    const feedback = [
      godClassFinding(reading, dimensions),
      hardWiredPricingFinding(reading, dimensions),
      noAbstractionFinding(reading, dimensions),
      missingVehicleTypesFinding(reading, dimensions),
      unexplainedDesignFinding(reading, dimensions),
    ].filter((item): item is FeedbackItemPayload => item !== null);

    return {
      dimensionScores: scoreDimensions(dimensions, reading, feedback),
      strengths: strengthsFor(reading),
      feedback,
      tradeOffs: tradeOffsFor(reading),
    };
  }
}

// ---------------------------------------------------------------------------
// Reading the submission
// ---------------------------------------------------------------------------

const DIMENSION_ROLES = ['COHESION', 'COUPLING', 'COMPLETENESS', 'EXTENSIBILITY'] as const;
type DimensionRole = (typeof DIMENSION_ROLES)[number];
type DimensionIds = Record<DimensionRole, string>;

/**
 * Maps rubric dimension ids onto the roles these rules reason about.
 *
 * Matches on meaning rather than position, so reordering a rubric or renaming a
 * dimension does not silently attach feedback to the wrong axis. Positional
 * assignment is the fallback for a rubric that uses none of the expected words.
 */
function resolveDimensions(ids: readonly string[]): DimensionIds {
  const patterns: Record<DimensionRole, RegExp> = {
    COHESION: /cohesion|responsib/i,
    COUPLING: /coupling|abstraction/i,
    COMPLETENESS: /complete|requirement/i,
    EXTENSIBILITY: /extensib|trade/i,
  };

  const fallback = ids[0] ?? 'unknown-dimension';
  const resolved = {} as DimensionIds;

  DIMENSION_ROLES.forEach((role, index) => {
    resolved[role] = ids.find((id) => patterns[role].test(id)) ?? ids[index] ?? fallback;
  });

  return resolved;
}

interface SubmissionReading {
  readonly isEmpty: boolean;
  readonly skeleton: string;
  readonly decisions: string;
  readonly assumptions: string;
  readonly typeNames: readonly string[];
  readonly hasAbstraction: boolean;
  readonly allocationLine: string | null;
  readonly pricingLine: string | null;
  readonly ticketLine: string | null;
  readonly vehicleTypeLine: string | null;
  readonly concernCount: number;
}

const TYPE_PATTERN =
  /^[ \t]*(?:(?:public|private|protected|abstract|final|sealed|static|export|open|data)\s+)*(?:class|interface|enum|record|struct|trait|protocol)\s+([A-Za-z_$][\w$]*)/gim;

function readSubmission(sections: {
  designSkeleton: string;
  designDecisions: string;
  assumptions: string;
}): SubmissionReading {
  const skeleton = sections.designSkeleton;
  const typeNames = matchAll(skeleton, TYPE_PATTERN);

  const allocationLine = findLine(skeleton, /assign|allocat|findspot|park\w*\(|reserve/i);
  const pricingLine = findLine(skeleton, /fee|price|charge|cost|bill|payment|pay\(/i);
  const ticketLine = findLine(skeleton, /ticket/i);
  const vehicleTypeLine = findLine(skeleton, /vehicletype|cartype|enum\s+\w*(vehicle|spot|size)/i);

  const concernCount = [allocationLine, pricingLine, ticketLine].filter(Boolean).length;

  return {
    isEmpty:
      skeleton.trim().length === 0 &&
      sections.designDecisions.trim().length === 0 &&
      sections.assumptions.trim().length === 0,
    skeleton,
    decisions: sections.designDecisions,
    assumptions: sections.assumptions,
    typeNames,
    hasAbstraction: /\b(interface|abstract\s+class|trait|protocol)\b/i.test(skeleton),
    allocationLine,
    pricingLine,
    ticketLine,
    vehicleTypeLine,
    concernCount,
  };
}

function matchAll(text: string, pattern: RegExp): string[] {
  const local = new RegExp(pattern.source, pattern.flags);
  const found: string[] = [];

  let match = local.exec(text);
  while (match !== null) {
    if (match[1]) found.push(match[1]);
    match = local.exec(text);
  }

  return [...new Set(found)];
}

/**
 * The first line matching a pattern, trimmed.
 *
 * Every rule quotes a real line through this, so the evidence it produces
 * survives EvidenceVerifier. A mock that invented snippets would be discarded
 * by the platform's own defences - and the test suite would never notice.
 */
function findLine(text: string, pattern: RegExp): string | null {
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (trimmed.length > 0 && pattern.test(trimmed)) return trimmed;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Rules
// ---------------------------------------------------------------------------

function godClassFinding(
  reading: SubmissionReading,
  dimensions: DimensionIds,
): FeedbackItemPayload | null {
  if (reading.typeNames.length !== 1 || reading.concernCount < 2) return null;

  const owner = reading.typeNames[0] ?? 'the single class';
  const evidence = reading.pricingLine ?? reading.allocationLine;
  if (!evidence) return null;

  return {
    dimensionId: dimensions.COHESION,
    severity: Severity.CRITICAL,
    category: FeedbackCategory.COHESION,
    evidence,
    issue:
      `${owner} carries every responsibility in the design: it allocates spots, ` +
      `issues tickets and calculates charges.`,
    whyItMatters:
      `Those responsibilities change for different reasons and on different ` +
      `schedules. A new pricing rule and a new allocation policy would both edit ` +
      `${owner}, so unrelated changes collide in one file and each one risks the other.`,
    suggestion:
      `Split by reason to change: a SpotAllocator that owns assignment, and a ` +
      `separate collaborator that owns pricing. ${owner} then coordinates them ` +
      `rather than implementing them.`,
    principle: 'Single Responsibility Principle',
    pattern: null,
  };
}

function hardWiredPricingFinding(
  reading: SubmissionReading,
  dimensions: DimensionIds,
): FeedbackItemPayload | null {
  if (!reading.pricingLine || reading.hasAbstraction) return null;

  return {
    dimensionId: dimensions.EXTENSIBILITY,
    severity: Severity.MAJOR,
    category: FeedbackCategory.EXTENSIBILITY,
    evidence: reading.pricingLine,
    issue: 'Fee calculation is written directly into a concrete class with no abstraction behind it.',
    whyItMatters:
      'Pricing is the part of a parking lot most likely to change - weekend rates, ' +
      'EV charging, season passes. Each new rule means editing this method rather ' +
      'than adding a type alongside it, so the class grows a branch per variation.',
    suggestion:
      'Put pricing behind a FeeStrategy interface with one implementation per rule, ' +
      'and have the lot depend on the interface.',
    principle: 'Open/Closed Principle',
    pattern: 'Strategy',
  };
}

function noAbstractionFinding(
  reading: SubmissionReading,
  dimensions: DimensionIds,
): FeedbackItemPayload | null {
  if (reading.hasAbstraction || reading.typeNames.length < 2) return null;

  const evidence = findLine(reading.skeleton, /^\s*(?:public\s+|export\s+)?class\s+/i);
  if (!evidence) return null;

  return {
    dimensionId: dimensions.COUPLING,
    severity: Severity.MAJOR,
    category: FeedbackCategory.ABSTRACTION,
    evidence,
    issue: 'Every type in the design is concrete; nothing depends on an interface.',
    whyItMatters:
      'With only concrete types, each class is bound to one specific collaborator. ' +
      'Substituting behaviour later means changing the class that depends on it, ' +
      'and there is no seam to test against in isolation.',
    suggestion:
      'Identify the one or two places where behaviour genuinely varies - allocation ' +
      'policy and pricing are the usual candidates - and introduce an interface there. ' +
      'Do not add interfaces where nothing varies.',
    principle: 'Dependency Inversion Principle',
    pattern: null,
  };
}

function missingVehicleTypesFinding(
  reading: SubmissionReading,
  dimensions: DimensionIds,
): FeedbackItemPayload | null {
  if (reading.vehicleTypeLine !== null) return null;
  if (/vehicle|car|bike|truck|motorcycle/i.test(reading.skeleton) === false) return null;

  const evidence = findLine(reading.skeleton, /vehicle|car|bike|truck|motorcycle/i);
  if (!evidence) return null;

  return {
    dimensionId: dimensions.COMPLETENESS,
    severity: Severity.MAJOR,
    category: FeedbackCategory.REQUIREMENT_GAP,
    evidence,
    issue:
      'Vehicles appear in the design, but nothing distinguishes one vehicle type ' +
      'from another.',
    whyItMatters:
      'Supporting multiple vehicle types is a stated HIGH requirement, and it drives ' +
      'spot sizing and pricing. Without the distinction modelled, the rules that ' +
      'depend on it have nowhere to live.',
    suggestion:
      'Model the distinction explicitly - a VehicleType enum, or a small Vehicle ' +
      'hierarchy - and let spot compatibility be decided from it.',
    principle: null,
    pattern: null,
  };
}

function unexplainedDesignFinding(
  reading: SubmissionReading,
  dimensions: DimensionIds,
): FeedbackItemPayload | null {
  if (reading.decisions.trim().length >= 40) return null;

  const evidence = reading.decisions.trim() || reading.typeNames[0] || 'the design skeleton';

  return {
    dimensionId: dimensions.COMPLETENESS,
    severity: Severity.MAJOR,
    category: FeedbackCategory.INSUFFICIENT_DETAIL,
    evidence,
    issue: 'The design decisions field does not explain why these abstractions were chosen.',
    whyItMatters:
      'In an interview the design is the easy half; the reasoning is what is actually ' +
      'probed. A design nobody can justify reads as copied rather than reasoned, and ' +
      'there is nothing here to assess that reasoning against.',
    suggestion:
      'For each boundary you drew, write the one sentence that answers "what would ' +
      'have to change for this to be wrong?"',
    principle: null,
    pattern: null,
  };
}

// ---------------------------------------------------------------------------
// Scoring, strengths, trade-offs
// ---------------------------------------------------------------------------

/**
 * A competent-but-unremarkable design sits at 3, matching the instruction the
 * real prompt gives a model. Detected problems pull it down; specific positive
 * signals pull it up. Nothing here awards a 5 for the absence of detected
 * problems, because these rules are not thorough enough to earn that - grade
 * inflation from a heuristic evaluator would be the worst outcome available.
 */
const BASE_SCORE = 3;

function scoreDimensions(
  dimensions: DimensionIds,
  reading: SubmissionReading,
  feedback: readonly FeedbackItemPayload[],
): LlmEvaluationPayload['dimensionScores'] {
  const bonuses = positiveSignals(reading, dimensions);

  return DIMENSION_ROLES.map((role) => {
    const dimensionId = dimensions[role];
    const items = feedback.filter((item) => item.dimensionId === dimensionId);

    const penalty = items.reduce(
      (total, item) => total + (item.severity === Severity.CRITICAL ? 2 : 1),
      0,
    );

    const score = clamp(BASE_SCORE + (bonuses[role] ?? 0) - penalty);

    return {
      dimensionId,
      score,
      justification: justify(role, score, items.length, reading),
    };
  });
}

function positiveSignals(
  reading: SubmissionReading,
  _dimensions: DimensionIds,
): Partial<Record<DimensionRole, number>> {
  return {
    COHESION: reading.typeNames.length >= 4 ? 1 : 0,
    COUPLING: reading.hasAbstraction ? 1 : 0,
    COMPLETENESS: reading.concernCount === 3 ? 1 : 0,
    EXTENSIBILITY: reading.hasAbstraction && reading.pricingLine !== null ? 1 : 0,
  };
}

function justify(
  role: DimensionRole,
  score: number,
  issueCount: number,
  reading: SubmissionReading,
): string {
  const typeCount = reading.typeNames.length;

  const bases: Record<DimensionRole, string> = {
    COHESION:
      typeCount <= 1
        ? 'The design is held in a single type, so responsibilities are not separated at all.'
        : `Responsibilities are spread across ${typeCount} types, and the split follows the problem's natural boundaries.`,
    COUPLING: reading.hasAbstraction
      ? 'At least one dependency points at an interface rather than a concrete type.'
      : 'Every dependency in the design is on a concrete type.',
    COMPLETENESS: `${reading.concernCount} of the three core flows - allocation, ticketing and pricing - are visible in the skeleton.`,
    EXTENSIBILITY: reading.hasAbstraction
      ? 'A varying rule has been placed behind an abstraction, so a new variant can be added rather than edited in.'
      : 'A new pricing or allocation rule would mean editing existing classes rather than adding new ones.',
  };

  const tail =
    issueCount > 0
      ? ` ${issueCount} issue${issueCount === 1 ? '' : 's'} on this dimension brought the score to ${score}/${MAX_DIMENSION_SCORE}.`
      : ` Scored ${score}/${MAX_DIMENSION_SCORE}.`;

  return bases[role] + tail;
}

function strengthsFor(reading: SubmissionReading): string[] {
  const strengths: string[] = [];

  if (reading.hasAbstraction) {
    strengths.push(
      'Behaviour that varies is placed behind an interface rather than branched on inline.',
    );
  }
  if (reading.typeNames.length >= 4) {
    const shown = reading.typeNames.slice(0, 4).join(', ');
    const remainder = reading.typeNames.length - 4;
    const named = remainder > 0 ? `${shown} and ${remainder} more` : shown;

    strengths.push(
      `The design is decomposed into ${reading.typeNames.length} types (${named}), rather than one class doing everything.`,
    );
  }
  if (reading.ticketLine && reading.pricingLine && reading.allocationLine) {
    strengths.push('All three core flows - allocation, ticketing and pricing - are represented.');
  }
  if (reading.assumptions.trim().length >= 40) {
    strengths.push('Scope is stated explicitly, including what was deliberately left out.');
  }

  // Deliberately no consolation entry. An empty strengths list is a legitimate
  // outcome, and manufactured praise devalues the criticism next to it.
  return strengths;
}

function tradeOffsFor(reading: SubmissionReading): TradeOffPayload[] {
  if (reading.typeNames.length === 1) {
    return [
      {
        decision: `Holding the entire design inside ${reading.typeNames[0] ?? 'one class'}.`,
        upside: 'The end-to-end flow is readable in one place, with no indirection to follow.',
        downside:
          'Every future rule change edits the same class, and no part of the flow can be ' +
          'tested or replaced on its own.',
      },
    ];
  }

  if (reading.hasAbstraction) {
    return [
      {
        decision: 'Introducing an interface for the varying rule.',
        upside: 'New variants are added rather than branched in, and each can be tested alone.',
        downside:
          'One more indirection to follow when reading the flow, which is only worth ' +
          'paying where the behaviour genuinely varies.',
      },
    ];
  }

  return [];
}

function clamp(score: number): number {
  return Math.max(0, Math.min(MAX_DIMENSION_SCORE, Math.round(score)));
}

function emptySubmissionPayload(dimensions: DimensionIds): LlmEvaluationPayload {
  return {
    dimensionScores: DIMENSION_ROLES.map((role) => ({
      dimensionId: dimensions[role],
      score: 0,
      justification: 'Nothing was submitted, so there is no design to assess on this dimension.',
    })),
    strengths: [],
    feedback: [
      {
        dimensionId: dimensions.COMPLETENESS,
        severity: Severity.CRITICAL,
        category: FeedbackCategory.INSUFFICIENT_DETAIL,
        evidence: '(empty)',
        issue: 'The submission is empty.',
        whyItMatters: 'There is no design to evaluate, so no feedback can be grounded in your work.',
        suggestion:
          'Start with the nouns in the requirements, give each type one job, and write ' +
          'one sentence per boundary explaining why it sits there.',
        principle: null,
        pattern: null,
      },
    ],
    tradeOffs: [],
  };
}
