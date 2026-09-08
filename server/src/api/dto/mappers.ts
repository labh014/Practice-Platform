import {
  type Attempt,
  AttemptStatus,
  type ComparisonReport,
  type EvaluationFinding,
  type EvaluationResult,
  type EvaluationRubric,
  type FeedbackItem,
  isBlockingSeverity,
  MAX_DIMENSION_SCORE,
  type Problem,
  type Submission,
} from '../../domain';
import type {
  AttemptDto,
  AttemptSummaryDto,
  ComparisonReportDto,
  DimensionScoreDto,
  EvaluationResultDto,
  FeedbackItemDto,
  ProblemDto,
  ProblemSummaryDto,
  StructuralFindingDto,
  SubmissionDto,
} from './types';

/**
 * Maps a problem for the workspace.
 *
 * `latestAttemptNumber` decides whether the change scenario travels at all.
 * Gating it server-side rather than in the UI is deliberate: the scenario is
 * the extensibility question, and a learner who reads it in the network tab
 * before their first attempt has been handed the answer to what it measures.
 */
export function toProblemDto(problem: Problem, latestAttemptNumber: number): ProblemDto {
  const revealed = problem.hasRevealedChangeScenario(latestAttemptNumber);
  const scenario = problem.changeScenario;

  return {
    id: problem.id,
    title: problem.title,
    summary: problem.summary,
    description: problem.description,
    requirements: problem.requirementsByImportance.map((requirement) => ({
      id: requirement.id,
      text: requirement.text,
      importance: requirement.importance,
    })),
    dimensions: problem.rubric.dimensions.map((dimension) => ({
      id: dimension.id,
      name: dimension.name,
      description: dimension.description,
      weight: dimension.weight,
      bands: dimension.bands.map((band) => ({
        label: band.label,
        descriptor: band.descriptor,
      })),
    })),
    changeScenario:
      revealed && scenario
        ? {
            id: scenario.id,
            title: scenario.title,
            description: scenario.description,
            probesDimensionId: scenario.probesDimensionId,
            unlocksAfterAttempt: scenario.unlocksAfterAttempt,
          }
        : null,
    // Revealed after attempt 1; in force from attempt 2 onward.
    changeScenarioActive: problem.activeChangeScenarioFor(latestAttemptNumber + 1) !== null,
  };
}

export function toProblemSummaryDto(problem: Problem, attempts: Attempt[]): ProblemSummaryDto {
  const scored = attempts
    .map((attempt) => attempt.result?.overallScore)
    .filter((score): score is number => score !== undefined);

  return {
    id: problem.id,
    title: problem.title,
    summary: problem.summary,
    requirementCount: problem.requirements.length,
    attemptCount: attempts.length,
    bestScore: scored.length > 0 ? Math.max(...scored) : null,
    latestStatus: attempts.at(-1)?.status ?? null,
  };
}

export function toAttemptDto(attempt: Attempt, rubric: EvaluationRubric): AttemptDto {
  return {
    id: attempt.id,
    problemId: attempt.problemId,
    userId: attempt.userId,
    attemptNumber: attempt.attemptNumber,
    status: attempt.status,
    submission: toSubmissionDto(attempt.submission),
    result: attempt.result ? toEvaluationResultDto(attempt.result, rubric) : null,
    structuralFindings: attempt.structuralFindings.map(toStructuralFindingDto),
    failureReason: attempt.failureReason,
    isRetryable: attempt.isRetryable,
    createdAt: attempt.createdAt.toISOString(),
    evaluatedAt: attempt.evaluationEndedAt?.toISOString() ?? null,
  };
}

export function toAttemptSummaryDto(attempt: Attempt): AttemptSummaryDto {
  const result = attempt.result;

  return {
    id: attempt.id,
    attemptNumber: attempt.attemptNumber,
    status: attempt.status,
    overallScore: result?.overallScore ?? null,
    dimensionScores:
      result?.dimensionScores.map((score) => ({
        dimensionId: score.dimensionId,
        score: score.score,
      })) ?? [],
    openIssueCount:
      result?.feedback.filter((item) => isBlockingSeverity(item.severity)).length ?? 0,
    createdAt: attempt.createdAt.toISOString(),
  };
}

export function toSubmissionDto(submission: Submission): SubmissionDto {
  return {
    designSkeleton: submission.designSkeleton,
    designDecisions: submission.designDecisions,
    assumptions: submission.assumptions,
  };
}

export function toEvaluationResultDto(
  result: EvaluationResult,
  rubric: EvaluationRubric,
): EvaluationResultDto {
  return {
    overallScore: result.overallScore,
    dimensionScores: result.dimensionScores.map((score) =>
      toDimensionScoreDto(score, rubric),
    ),
    strengths: [...result.strengths],
    feedback: result.feedback.map((item) => toFeedbackItemDto(item, rubric)),
    tradeOffs: result.tradeOffs.map((tradeOff) => ({
      decision: tradeOff.decision,
      upside: tradeOff.upside,
      downside: tradeOff.downside,
    })),
    comparison: result.comparison ? toComparisonReportDto(result.comparison) : null,
    evaluatorModel: result.evaluatorModel,
    evaluatedAt: result.evaluatedAt.toISOString(),
  };
}

function toDimensionScoreDto(
  score: EvaluationResult['dimensionScores'][number],
  rubric: EvaluationRubric,
): DimensionScoreDto {
  const dimension = rubric.find(score.dimensionId);

  return {
    dimensionId: score.dimensionId,
    dimensionName: dimension?.name ?? score.dimensionId,
    weight: dimension?.weight ?? 0,
    score: score.score,
    maxScore: MAX_DIMENSION_SCORE,
    justification: score.justification,
    bandDescriptor: dimension?.bandFor(score.score).descriptor ?? '',
  };
}

function toFeedbackItemDto(item: FeedbackItem, rubric: EvaluationRubric): FeedbackItemDto {
  return {
    id: item.id,
    dimensionId: item.dimensionId,
    dimensionName: rubric.find(item.dimensionId)?.name ?? item.dimensionId,
    severity: item.severity,
    category: item.category,
    evidence: item.evidence,
    issue: item.issue,
    whyItMatters: item.whyItMatters,
    suggestion: item.suggestion,
    principle: item.principle,
    pattern: item.pattern,
  };
}

function toComparisonReportDto(comparison: ComparisonReport): ComparisonReportDto {
  return {
    previousAttemptId: comparison.previousAttemptId,
    previousAttemptNumber: comparison.previousAttemptNumber,
    previousOverallScore: comparison.previousOverallScore,
    currentOverallScore: comparison.currentOverallScore,
    overallDelta: comparison.overallDelta,
    hasImproved: comparison.hasImproved,
    dimensionDeltas: comparison.dimensionDeltas.map((delta) => ({
      dimensionId: delta.dimensionId,
      dimensionName: delta.dimensionName,
      previousScore: delta.previousScore,
      currentScore: delta.currentScore,
      delta: delta.delta,
      direction: delta.direction,
      scopeChanged: delta.scopeChanged,
    })),
    resolvedCategories: [...comparison.resolvedCategories],
    persistingCategories: [...comparison.persistingCategories],
  };
}

function toStructuralFindingDto(finding: EvaluationFinding): StructuralFindingDto {
  return {
    code: finding.code,
    severity: finding.severity,
    message: finding.message,
    detail: finding.detail,
  };
}

/** Whether the client should keep polling this attempt. */
export function isPending(attempt: Attempt): boolean {
  return attempt.status === AttemptStatus.SUBMITTED || attempt.status === AttemptStatus.EVALUATING;
}
