import { describe, expect, it } from 'vitest';

import { Severity, Submission } from '../../domain';
import {
  buildTestProblem,
  emptySubmission,
  godClassSubmission,
  wellSeparatedSubmission,
} from '../../testing/fixtures';
import { EvaluationContext } from './EvaluationContext';
import { StructuralEvaluator } from './StructuralEvaluator';
import { analyseSkeleton, StructuralFindingCode } from './structuralChecks';

const evaluator = new StructuralEvaluator();

function contextFor(submission: Submission, attemptNumber = 1): EvaluationContext {
  return new EvaluationContext({
    problem: buildTestProblem(),
    submission,
    attemptNumber,
  });
}

function codesFor(submission: Submission): string[] {
  return evaluator.findingsFor(contextFor(submission)).map((finding) => finding.code);
}

describe('StructuralEvaluator', () => {
  it('reports a single decisive finding for a completely empty submission', () => {
    const findings = evaluator.findingsFor(contextFor(emptySubmission()));

    expect(findings).toHaveLength(1);
    expect(findings[0]?.code).toBe(StructuralFindingCode.EMPTY_SUBMISSION);
    expect(findings[0]?.severity).toBe(Severity.CRITICAL);
  });

  it('flags a skeleton too short to describe a design', () => {
    const codes = codesFor(
      Submission.create({
        designSkeleton: 'class ParkingLot { }',
        designDecisions: 'It parks cars.',
        assumptions: '',
      }),
    );

    expect(codes).toContain(StructuralFindingCode.DESIGN_SKELETON_TOO_SHORT);
  });

  it('flags a design that puts every responsibility in one type', () => {
    expect(codesFor(godClassSubmission())).toContain(StructuralFindingCode.SINGLE_TYPE_DESIGN);
  });

  it('flags a skeleton with no identifiable types', () => {
    const codes = codesFor(
      Submission.create({
        designSkeleton: [
          'The parking lot has spots.',
          'Cars come in and get a ticket.',
          'They pay when they leave.',
          'Fees depend on how long they stayed.',
        ].join('\n'),
        designDecisions: 'I described the flow rather than the types for now.',
        assumptions: 'Assumed one lot with a fixed number of spots available.',
      }),
    );

    expect(codes).toContain(StructuralFindingCode.NO_TYPE_DECLARATIONS);
  });

  it('flags types declared without any behaviour', () => {
    const codes = codesFor(
      Submission.create({
        designSkeleton: [
          'class ParkingLot { }',
          'class Spot { }',
          'class Ticket { }',
          'class Vehicle { }',
        ].join('\n'),
        designDecisions:
          'I started from the nouns in the problem statement and will add behaviour next.',
        assumptions: 'Assumed a single lot with fixed capacity for now.',
      }),
    );

    expect(codes).toContain(StructuralFindingCode.NO_METHODS);
  });

  it('flags thin reasoning fields, since the reasoning is the practice', () => {
    const codes = codesFor(
      Submission.create({
        designSkeleton: wellSeparatedSubmission().designSkeleton,
        designDecisions: 'Seemed right.',
        assumptions: '',
      }),
    );

    expect(codes).toContain(StructuralFindingCode.THIN_DESIGN_DECISIONS);
    expect(codes).toContain(StructuralFindingCode.THIN_ASSUMPTIONS);
  });

  it('stays silent on a well-formed submission', () => {
    expect(codesFor(wellSeparatedSubmission())).toHaveLength(0);
  });

  it('exposes the same findings through the async IEvaluator contract', async () => {
    const output = await evaluator.evaluate(contextFor(godClassSubmission()));

    expect(output.findings.length).toBeGreaterThan(0);
    // The deterministic pass measures the submission; it has no view on quality.
    expect(output.dimensionScores).toHaveLength(0);
    expect(output.feedback).toHaveLength(0);
  });
});

describe('analyseSkeleton', () => {
  it('recognises declarations across the notations learners actually use', () => {
    const submission = Submission.create({
      designSkeleton: [
        'public abstract class Vehicle { }',
        'interface FeeStrategy { }',
        'class SpotAllocator:',
        'export class TicketService { }',
        'enum SpotSize { }',
      ].join('\n'),
      designDecisions: 'Mixed notation on purpose while sketching the design out.',
      assumptions: 'Assumed the notation does not matter at this stage of design.',
    });

    expect(analyseSkeleton(submission).typeNames).toEqual([
      'Vehicle',
      'FeeStrategy',
      'SpotAllocator',
      'TicketService',
      'SpotSize',
    ]);
  });

  it('does not mistake control flow for methods', () => {
    const submission = Submission.create({
      designSkeleton: [
        'class ParkingLot {',
        '  assignSpot(Vehicle v) {',
        '    if (spots.isEmpty()) { return null; }',
        '    for (Spot s : spots) { }',
        '  }',
        '}',
      ].join('\n'),
      designDecisions: 'Sketched the allocation loop directly inside the lot for now.',
      assumptions: 'Assumed spots are held in a simple list for this first pass.',
    });

    const { methodNames } = analyseSkeleton(submission);

    expect(methodNames).toContain('assignSpot');
    expect(methodNames).not.toContain('if');
    expect(methodNames).not.toContain('for');
  });
});
