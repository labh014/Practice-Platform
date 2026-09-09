import type {
  AttemptStatus,
  DeltaDirection,
  FeedbackCategory,
  Importance,
  Severity,
} from '../../domain';

/**
 * The wire contract.
 *
 * Written out explicitly rather than serialising domain objects directly. The
 * aggregates hold private state behind getters, so JSON.stringify would quietly
 * emit the wrong shape - but the better reason is that an explicit contract
 * means renaming a domain field is a compile error here, not a silently broken
 * client.
 */

export interface RequirementDto {
  readonly id: string;
  readonly text: string;
  readonly importance: Importance;
}

export interface ScoreBandDto {
  readonly label: string;
  readonly descriptor: string;
}

export interface DimensionDto {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly weight: number;
  readonly bands: readonly ScoreBandDto[];
}

export interface ChangeScenarioDto {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly probesDimensionId: string;
  readonly unlocksAfterAttempt: number;
}

export interface ProblemDto {
  readonly id: string;
  readonly title: string;
  readonly summary: string;
  readonly description: string;
  readonly requirements: readonly RequirementDto[];
  readonly dimensions: readonly DimensionDto[];
  /**
   * Present only once the learner has earned it.
   *
   * Withheld before the unlock rather than merely hidden by the UI: a learner
   * reading the network tab would otherwise see the extensibility question
   * before making the design it is meant to test.
   */
  readonly changeScenario: ChangeScenarioDto | null;
  readonly changeScenarioActive: boolean;
}

export interface ProblemSummaryDto {
  readonly id: string;
  readonly title: string;
  readonly summary: string;
  readonly requirementCount: number;
  readonly attemptCount: number;
  readonly bestScore: number | null;
  readonly latestStatus: AttemptStatus | null;
}

export interface DimensionScoreDto {
  readonly dimensionId: string;
  readonly dimensionName: string;
  readonly weight: number;
  /** Null when the evaluator declined to judge this dimension. */
  readonly score: number | null;
  readonly maxScore: number;
  readonly justification: string;
  /**
   * The written standard this score corresponds to.
   *
   * Sent with the number so the learner never sees a bare verdict. A "2/5" that
   * arrives with the sentence defining what a 2 means here is something they can
   * argue with; without it, it is an oracle's pronouncement.
   */
  readonly bandDescriptor: string;
}

export interface FeedbackItemDto {
  readonly id: string;
  readonly dimensionId: string;
  readonly dimensionName: string;
  readonly severity: Severity;
  readonly category: FeedbackCategory;
  readonly evidence: string;
  readonly issue: string;
  readonly whyItMatters: string;
  readonly suggestion: string;
  readonly principle: string | null;
  readonly pattern: string | null;
}

export interface TradeOffDto {
  readonly decision: string;
  readonly upside: string;
  readonly downside: string;
}

export interface DimensionDeltaDto {
  readonly dimensionId: string;
  readonly dimensionName: string;
  readonly previousScore: number;
  readonly currentScore: number;
  readonly delta: number;
  readonly direction: DeltaDirection;
  readonly scopeChanged: boolean;
}

export interface ComparisonReportDto {
  readonly previousAttemptId: string;
  readonly previousAttemptNumber: number;
  readonly previousOverallScore: number;
  readonly currentOverallScore: number;
  readonly overallDelta: number;
  readonly hasImproved: boolean;
  readonly dimensionDeltas: readonly DimensionDeltaDto[];
  readonly resolvedCategories: readonly FeedbackCategory[];
  readonly persistingCategories: readonly FeedbackCategory[];
}

export interface EvaluationResultDto {
  /** Null when any dimension was left unassessed; there is no partial total. */
  readonly overallScore: number | null;
  readonly dimensionScores: readonly DimensionScoreDto[];
  readonly strengths: readonly string[];
  readonly feedback: readonly FeedbackItemDto[];
  readonly tradeOffs: readonly TradeOffDto[];
  readonly comparison: ComparisonReportDto | null;
  readonly evaluatorModel: string;
  readonly evaluatedAt: string;
}

export interface StructuralFindingDto {
  readonly code: string;
  readonly severity: Severity;
  readonly message: string;
  readonly detail: string | null;
}

export interface SubmissionDto {
  readonly designSkeleton: string;
  readonly designDecisions: string;
  readonly assumptions: string;
}

export interface AttemptDto {
  readonly id: string;
  readonly problemId: string;
  readonly userId: string;
  readonly attemptNumber: number;
  readonly status: AttemptStatus;
  readonly submission: SubmissionDto;
  readonly result: EvaluationResultDto | null;
  /** Retained even when evaluation failed, so a failure is never a blank screen. */
  readonly structuralFindings: readonly StructuralFindingDto[];
  readonly failureReason: string | null;
  readonly isRetryable: boolean;
  readonly createdAt: string;
  readonly evaluatedAt: string | null;
}

/** The lightweight shape used for the history rail. */
export interface AttemptSummaryDto {
  readonly id: string;
  readonly attemptNumber: number;
  readonly status: AttemptStatus;
  readonly overallScore: number | null;
  readonly dimensionScores: readonly { dimensionId: string; score: number | null }[];
  readonly openIssueCount: number;
  readonly createdAt: string;
}

export interface SubmitAttemptResponseDto {
  readonly attemptId: string;
  readonly status: AttemptStatus;
  readonly attemptNumber: number;
}

export interface ApiErrorDto {
  readonly error: {
    readonly code: string;
    readonly message: string;
    readonly details?: unknown;
  };
}
