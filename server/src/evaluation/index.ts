export { EvaluationContext } from './evaluators/EvaluationContext';
export { EvaluationOutput } from './evaluators/EvaluationOutput';
export { EvaluatorKind, type IEvaluator } from './evaluators/IEvaluator';
export { StructuralEvaluator } from './evaluators/StructuralEvaluator';
export {
  StructuralFindingCode,
  MIN_DESIGN_SKELETON_LINES,
  analyseSkeleton,
  type SkeletonAnalysis,
} from './evaluators/structuralChecks';

export type { LlmPrompt } from './prompt/LlmPrompt';
export { EvaluationPromptBuilder } from './prompt/EvaluationPromptBuilder';

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
