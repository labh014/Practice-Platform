import { AttemptService } from './application/AttemptService';
import { ProblemService } from './application/ProblemService';
import {
  createLlmClient,
  EvaluationOrchestrator,
  EvaluationPromptBuilder,
  type LlmClient,
  LlmEvaluator,
  StructuralEvaluator,
} from './evaluation';
import { InMemoryAttemptRepository, InMemoryProblemRepository } from './repositories';

export interface Container {
  readonly attempts: AttemptService;
  readonly problems: ProblemService;
  readonly attemptRepository: InMemoryAttemptRepository;
  readonly llmNotice: string;
}

/**
 * The composition root.
 *
 * Every wiring decision the application makes lives here and nowhere else, so
 * no class further in ever reaches for a concrete implementation or reads an
 * environment variable. That is what lets a test build the whole stack with a
 * stub LLM client and a synchronous dispatcher, and exercise the real routes
 * and the real services rather than a parallel arrangement that only resembles
 * production.
 */
export function createContainer(options?: {
  llmClient?: LlmClient;
  /** Injected by tests so evaluation can be awaited rather than raced. */
  dispatch?: (task: () => void) => void;
}): Container {
  const attemptRepository = new InMemoryAttemptRepository();
  const problemRepository = new InMemoryProblemRepository();

  const selection = options?.llmClient
    ? { client: options.llmClient, notice: `Semantic evaluation: ${options.llmClient.modelName}.` }
    : createLlmClient();

  const promptBuilder = new EvaluationPromptBuilder();

  const orchestrator = new EvaluationOrchestrator({
    // Order matters: the deterministic pass runs first so its findings become
    // context for the semantic one.
    evaluators: [
      new StructuralEvaluator(),
      new LlmEvaluator({ client: selection.client, promptBuilder }),
    ],
    evaluatorModel: selection.client.modelName,
  });

  const attempts = new AttemptService({
    attempts: attemptRepository,
    problems: problemRepository,
    orchestrator,
    ...(options?.dispatch ? { dispatch: options.dispatch } : {}),
  });

  const problems = new ProblemService({
    problems: problemRepository,
    attempts: attemptRepository,
  });

  return {
    attempts,
    problems,
    attemptRepository,
    llmNotice: selection.notice,
  };
}
