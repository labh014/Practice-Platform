import { EvaluationFinding, FindingSource, Severity } from '../../domain';
import type { EvaluationContext } from './EvaluationContext';
import { EvaluationOutput } from './EvaluationOutput';
import { EvaluatorKind, type IEvaluator } from './IEvaluator';
import {
  analyseSkeleton,
  MIN_DESIGN_SKELETON_LINES,
  StructuralFindingCode,
} from './structuralChecks';

/**
 * The deterministic pass: objective observations about the submission itself.
 *
 * This evaluator has no view on whether a design is good. It reports what is
 * measurably there - whether any types were declared, whether the reasoning
 * fields were filled in, whether one class is doing all the work - and stops.
 *
 * Critically, it is not a gate (PRD 4.1). A thin submission is not turned away
 * with a canned message; its findings are handed to the semantic evaluator as
 * context, so the learner gets a real low score they can see the reasons for
 * rather than a refusal. That is the difference between a system that teaches
 * and a form validator.
 *
 * The value of running it first is that the model then argues with evidence
 * instead of inventing it. Told "the skeleton declares one type and no
 * methods", it grounds its score in that. Told nothing, it is liable to
 * hallucinate a class list and critique that.
 */
export class StructuralEvaluator implements IEvaluator {
  readonly name = 'structural';
  readonly kind = EvaluatorKind.DETERMINISTIC;

  // eslint-disable-next-line @typescript-eslint/require-await -- satisfies the async IEvaluator contract
  async evaluate(context: EvaluationContext): Promise<EvaluationOutput> {
    return EvaluationOutput.ofFindings(this.findingsFor(context));
  }

  /** Synchronous entry point, for tests and for callers that do not need the async contract. */
  findingsFor(context: EvaluationContext): EvaluationFinding[] {
    const { submission } = context;

    if (submission.isEmpty()) {
      return [
        finding({
          code: StructuralFindingCode.EMPTY_SUBMISSION,
          severity: Severity.CRITICAL,
          message: 'Nothing was submitted.',
          detail: 'All three fields were empty.',
        }),
      ];
    }

    const analysis = analyseSkeleton(submission);
    const findings: EvaluationFinding[] = [];

    if (!submission.hasDesignSkeleton()) {
      findings.push(
        finding({
          code: StructuralFindingCode.EMPTY_DESIGN_SKELETON,
          severity: Severity.CRITICAL,
          message: 'No design skeleton was provided.',
          detail: 'Design decisions cannot be assessed without the design they describe.',
        }),
      );
    } else {
      if (analysis.nonEmptyLineCount < MIN_DESIGN_SKELETON_LINES) {
        findings.push(
          finding({
            code: StructuralFindingCode.DESIGN_SKELETON_TOO_SHORT,
            severity: Severity.MAJOR,
            message: 'The design skeleton is too short to describe a design.',
            detail: `${analysis.nonEmptyLineCount} non-empty line(s); at least ${MIN_DESIGN_SKELETON_LINES} expected.`,
          }),
        );
      }

      if (analysis.typeNames.length === 0) {
        findings.push(
          finding({
            code: StructuralFindingCode.NO_TYPE_DECLARATIONS,
            severity: Severity.MAJOR,
            message: 'No classes or interfaces could be identified in the skeleton.',
            detail: 'Expected declarations such as "class ParkingLot" or "interface FeeStrategy".',
          }),
        );
      } else if (analysis.typeNames.length === 1) {
        findings.push(
          finding({
            code: StructuralFindingCode.SINGLE_TYPE_DESIGN,
            severity: Severity.MAJOR,
            message: 'The whole design sits in a single type.',
            detail:
              `Only "${analysis.typeNames[0]}" was declared. One type holding every ` +
              `responsibility is the most common shape of a low-cohesion design.`,
          }),
        );
      }

      if (analysis.methodNames.length === 0) {
        findings.push(
          finding({
            code: StructuralFindingCode.NO_METHODS,
            severity: Severity.MAJOR,
            message: 'No methods could be identified in the skeleton.',
            detail:
              'Types without behaviour say what the design holds but not what it does, ' +
              'so responsibilities cannot be assessed.',
          }),
        );
      }
    }

    // The reasoning fields are where LLD practice differs from writing code.
    // An interviewer probes why the boundaries fall where they do, so an empty
    // decisions field is a real gap in the practice, not a formatting problem.
    if (submission.hasThinDesignDecisions()) {
      findings.push(
        finding({
          code: StructuralFindingCode.THIN_DESIGN_DECISIONS,
          severity: Severity.MAJOR,
          message: 'The design decisions field is thin or empty.',
          detail:
            'The reasoning behind the abstractions is the part an interviewer probes; ' +
            'without it, only the shape of the design can be judged.',
        }),
      );
    }

    if (submission.hasThinAssumptions()) {
      findings.push(
        finding({
          code: StructuralFindingCode.THIN_ASSUMPTIONS,
          severity: Severity.MINOR,
          message: 'The assumptions field is thin or empty.',
          detail: 'Stating what was deliberately left out is part of scoping a design.',
        }),
      );
    }

    return findings;
  }
}

function finding(params: {
  code: string;
  severity: Severity;
  message: string;
  detail: string;
}): EvaluationFinding {
  return new EvaluationFinding({
    code: params.code,
    source: FindingSource.STRUCTURAL,
    severity: params.severity,
    message: params.message,
    detail: params.detail,
  });
}
