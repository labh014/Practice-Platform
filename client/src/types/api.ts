/**
 * The API contract, mirrored from server/src/api/dto/types.ts.
 *
 * Hand-mirrored rather than imported. Sharing the file would mean a third
 * package and a build step wiring two tsconfigs together, which is real
 * complexity to carry for roughly a hundred lines of types on a two-day build.
 * The trade is that the two copies can drift, so they are kept structurally
 * identical and in the same order to make a diff between them readable.
 */

export type Importance = 'HIGH' | 'MEDIUM' | 'LOW';

export type AttemptStatus = 'SUBMITTED' | 'EVALUATING' | 'COMPLETED' | 'FAILED';

export type Severity = 'CRITICAL' | 'MAJOR' | 'MINOR';

export type DeltaDirection = 'IMPROVED' | 'REGRESSED' | 'UNCHANGED';

export type FeedbackCategory =
  | 'COHESION'
  | 'COUPLING'
  | 'ABSTRACTION'
  | 'EXTENSIBILITY'
  | 'REQUIREMENT_GAP'
  | 'ENCAPSULATION'
  | 'PATTERN_MISUSE'
  | 'INHERITANCE_MISUSE'
  | 'NAMING'
  | 'EDGE_CASE'
  | 'INSUFFICIENT_DETAIL';

export interface Requirement {
  id: string;
  text: string;
  importance: Importance;
}

export interface ScoreBand {
  label: string;
  descriptor: string;
}

export interface Dimension {
  id: string;
  name: string;
  description: string;
  weight: number;
  bands: ScoreBand[];
}

export interface ChangeScenario {
  id: string;
  title: string;
  description: string;
  probesDimensionId: string;
  unlocksAfterAttempt: number;
}

export interface Problem {
  id: string;
  title: string;
  summary: string;
  description: string;
  requirements: Requirement[];
  dimensions: Dimension[];
  /** Null until the learner has earned it; the server withholds it, not the UI. */
  changeScenario: ChangeScenario | null;
  changeScenarioActive: boolean;
}

export interface ProblemSummary {
  id: string;
  title: string;
  summary: string;
  requirementCount: number;
  attemptCount: number;
  bestScore: number | null;
  latestStatus: AttemptStatus | null;
}

export interface DimensionScore {
  dimensionId: string;
  dimensionName: string;
  weight: number;
  /** Null when the evaluator declined to judge this dimension. */
  score: number | null;
  maxScore: number;
  justification: string;
  /** The written standard this score corresponds to. Never show the number alone. */
  bandDescriptor: string;
}

export interface FeedbackItem {
  id: string;
  dimensionId: string;
  dimensionName: string;
  severity: Severity;
  category: FeedbackCategory;
  evidence: string;
  issue: string;
  whyItMatters: string;
  suggestion: string;
  principle: string | null;
  pattern: string | null;
}

export interface TradeOff {
  decision: string;
  upside: string;
  downside: string;
}

export interface DimensionDelta {
  dimensionId: string;
  dimensionName: string;
  previousScore: number;
  currentScore: number;
  delta: number;
  direction: DeltaDirection;
  /** True when the change scenario raised the bar between the two attempts. */
  scopeChanged: boolean;
}

export interface ComparisonReport {
  previousAttemptId: string;
  previousAttemptNumber: number;
  previousOverallScore: number;
  currentOverallScore: number;
  overallDelta: number;
  hasImproved: boolean;
  dimensionDeltas: DimensionDelta[];
  resolvedCategories: FeedbackCategory[];
  persistingCategories: FeedbackCategory[];
}

export interface EvaluationResult {
  /** Null when any dimension was left unassessed; there is no partial total. */
  overallScore: number | null;
  dimensionScores: DimensionScore[];
  strengths: string[];
  feedback: FeedbackItem[];
  tradeOffs: TradeOff[];
  comparison: ComparisonReport | null;
  evaluatorModel: string;
  evaluatedAt: string;
}

export interface StructuralFinding {
  code: string;
  severity: Severity;
  message: string;
  detail: string | null;
}

export interface Submission {
  designSkeleton: string;
  designDecisions: string;
  assumptions: string;
}

export interface Attempt {
  id: string;
  problemId: string;
  userId: string;
  attemptNumber: number;
  status: AttemptStatus;
  submission: Submission;
  result: EvaluationResult | null;
  /** Present even when evaluation failed, so a failure is never a blank screen. */
  structuralFindings: StructuralFinding[];
  failureReason: string | null;
  isRetryable: boolean;
  createdAt: string;
  evaluatedAt: string | null;
}

export interface AttemptSummary {
  id: string;
  attemptNumber: number;
  status: AttemptStatus;
  overallScore: number | null;
  dimensionScores: { dimensionId: string; score: number | null }[];
  openIssueCount: number;
  createdAt: string;
}

export interface SubmitAttemptResponse {
  attemptId: string;
  status: AttemptStatus;
  attemptNumber: number;
}

export interface SubmitAttemptRequest {
  problemId: string;
  userId?: string;
  designSkeleton: string;
  designDecisions: string;
  assumptions: string;
}
