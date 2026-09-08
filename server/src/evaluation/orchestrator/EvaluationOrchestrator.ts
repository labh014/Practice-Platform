import {
  type EvaluationFinding,
  EvaluationResult,
  type Problem,
  type Submission,
} from '../../domain';
import { EvaluationContext } from '../evaluators/EvaluationContext';
import { EvaluationOutput } from '../evaluators/EvaluationOutput';
import { EvaluatorKind, type IEvaluator } from '../evaluators/IEvaluator';
import { ComparisonReportBuilder, type PreviousAttemptSnapshot } from './ComparisonReportBuilder';
import { EvidenceVerifier } from './EvidenceVerifier';
import { WeightedScoreCalculator } from './WeightedScoreCalculator';

export type OrchestrationOutcome =
  | {
      readonly ok: true;
      readonly result: EvaluationResult;
      readonly structuralFindings: readonly EvaluationFinding[];
      readonly discardedEvidenceCount: number;
    }
  | {
      readonly ok: false;
      readonly reason: string;
      /**
       * Preserved even on failure, so a failed attempt still shows the learner
       * the objective observations about their submission (assumption A10)
       * rather than an empty screen.
       */
      readonly structuralFindings: readonly EvaluationFinding[];
    };

export interface EvaluationRequest {
  readonly problem: Problem;
  readonly submission: Submission;
  readonly attemptNumber: number;
  readonly previous: PreviousAttemptSnapshot | null;
}

/**
 * Runs the evaluation pipeline and assembles the result.
 *
 * The order is the design:
 *
 *   1. deterministic evaluators, whose findings become context
 *   2. semantic evaluators, which now argue from measurements rather than
 *      imagining a class list to critique
 *   3. evidence verification, which drops anything quoting text the learner
 *      never wrote
 *   4. the overall score, computed from dimension scores and rubric weights
 *   5. the comparison against the previous attempt, computed from stored data
 *
 * Steps 3 to 5 are the ones that keep this explainable rather than oracular,
 * and none of them are the model's to decide. It supplies judgement about the
 * design; the platform supplies the arithmetic and the guarantees.
 *
 * It returns an outcome rather than throwing or mutating an Attempt. Deciding
 * what a failure means for the learner's history belongs to the application
 * service, so this stays a pure function of its inputs and stays testable
 * without one.
 */
export class EvaluationOrchestrator {
  private readonly evaluators: readonly IEvaluator[];
  private readonly evidenceVerifier: EvidenceVerifier;
  private readonly scoreCalculator: WeightedScoreCalculator;
  private readonly comparisonBuilder: ComparisonReportBuilder;
  private readonly evaluatorModel: string;

  constructor(params: {
    evaluators: readonly IEvaluator[];
    evaluatorModel: string;
    evidenceVerifier?: EvidenceVerifier;
    scoreCalculator?: WeightedScoreCalculator;
    comparisonBuilder?: ComparisonReportBuilder;
  }) {
    this.evaluators = params.evaluators;
    this.evaluatorModel = params.evaluatorModel;
    this.evidenceVerifier = params.evidenceVerifier ?? new EvidenceVerifier();
    this.scoreCalculator = params.scoreCalculator ?? new WeightedScoreCalculator();
    this.comparisonBuilder = params.comparisonBuilder ?? new ComparisonReportBuilder();
  }

  async evaluate(request: EvaluationRequest): Promise<OrchestrationOutcome> {
    const { problem, submission, attemptNumber, previous } = request;

    const baseContext = new EvaluationContext({
      problem,
      submission,
      attemptNumber,
      previousResult: previous?.result ?? null,
    });

    // 1. Deterministic pass. These never fail, so their findings are available
    //    to report whatever happens next.
    const deterministicOutputs = await this.run(EvaluatorKind.DETERMINISTIC, baseContext);
    const structuralFindings = EvaluationOutput.merge(deterministicOutputs).findings;

    // 2. Semantic pass, with the measurements in hand.
    const semanticContext = baseContext.withStructuralFindings(structuralFindings);

    let semanticOutputs: EvaluationOutput[];
    try {
      semanticOutputs = await this.run(EvaluatorKind.SEMANTIC, semanticContext);
    } catch (error) {
      return {
        ok: false,
        reason: error instanceof Error ? error.message : String(error),
        structuralFindings,
      };
    }

    const merged = EvaluationOutput.merge(semanticOutputs);

    // 3. Discard anything quoting text the learner did not write.
    const verification = this.evidenceVerifier.verify(merged.feedback, submission);

    // 4. Derive the headline number.
    let overallScore: number;
    try {
      overallScore = this.scoreCalculator.calculate(merged.dimensionScores, problem.rubric);
    } catch (error) {
      return {
        ok: false,
        reason: error instanceof Error ? error.message : String(error),
        structuralFindings,
      };
    }

    // 5. Compare against the previous attempt, if there is one.
    const comparison = previous
      ? this.comparisonBuilder.build({
          previous,
          currentDimensionScores: merged.dimensionScores,
          currentOverallScore: overallScore,
          currentFeedback: verification.kept,
          rubric: problem.rubric,
          currentChangeScenarioDimensionId:
            problem.activeChangeScenarioFor(attemptNumber)?.probesDimensionId ?? null,
        })
      : null;

    return {
      ok: true,
      result: new EvaluationResult({
        overallScore,
        dimensionScores: [...merged.dimensionScores],
        strengths: [...merged.strengths],
        feedback: [...verification.kept],
        tradeOffs: [...merged.tradeOffs],
        comparison,
        evaluatorModel: this.evaluatorModel,
      }),
      structuralFindings,
      discardedEvidenceCount: verification.discarded.length,
    };
  }

  private async run(kind: EvaluatorKind, context: EvaluationContext): Promise<EvaluationOutput[]> {
    const selected = this.evaluators.filter((evaluator) => evaluator.kind === kind);

    // Sequential rather than concurrent: with one evaluator per kind today it
    // changes nothing, and it keeps failures attributable to a single evaluator.
    const outputs: EvaluationOutput[] = [];
    for (const evaluator of selected) {
      outputs.push(await evaluator.evaluate(context));
    }

    return outputs;
  }
}
