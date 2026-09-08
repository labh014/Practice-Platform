export { EvaluationContext } from './evaluators/EvaluationContext';
export { EvaluationOutput } from './evaluators/EvaluationOutput';
export { EvaluatorKind, type IEvaluator } from './evaluators/IEvaluator';
export { StructuralEvaluator } from './evaluators/StructuralEvaluator';
export { LlmEvaluator, EvaluationValidationError } from './evaluators/LlmEvaluator';
export {
  StructuralFindingCode,
  MIN_DESIGN_SKELETON_LINES,
  analyseSkeleton,
  type SkeletonAnalysis,
} from './evaluators/structuralChecks';

export type { LlmPrompt } from './prompt/LlmPrompt';
export { EvaluationPromptBuilder } from './prompt/EvaluationPromptBuilder';
export {
  SUBMISSION_OPEN,
  SUBMISSION_CLOSE,
  extractDimensionIds,
  extractSubmissionSections,
} from './prompt/promptMarkers';

export {
  type LlmClient,
  LlmClientError,
  DEFAULT_LLM_TIMEOUT_MS,
} from './llm/LlmClient';
export { MockLlmClient } from './llm/MockLlmClient';
export { OpenAiLlmClient } from './llm/OpenAiLlmClient';
export { GeminiLlmClient } from './llm/GeminiLlmClient';
export {
  createLlmClient,
  LlmProvider,
  type LlmClientSelection,
} from './llm/createLlmClient';

export { EvidenceVerifier, type EvidenceVerification } from './orchestrator/EvidenceVerifier';
export { WeightedScoreCalculator } from './orchestrator/WeightedScoreCalculator';
export {
  ComparisonReportBuilder,
  type PreviousAttemptSnapshot,
} from './orchestrator/ComparisonReportBuilder';
export {
  EvaluationOrchestrator,
  type EvaluationRequest,
  type OrchestrationOutcome,
} from './orchestrator/EvaluationOrchestrator';

export {
  LlmEvaluationPayloadSchema,
  parseLlmEvaluationPayload,
  parseLlmEvaluationPayloadFromText,
  type LlmEvaluationPayload,
  type DimensionScorePayload,
  type FeedbackItemPayload,
  type TradeOffPayload,
  type PayloadParseResult,
} from './schema/LlmEvaluationPayloadSchema';
