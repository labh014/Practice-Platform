import { describe, expect, it } from 'vitest';

import { Importance, MAX_DIMENSION_SCORE, TOTAL_RUBRIC_WEIGHT } from '../domain';
import { InMemoryProblemRepository } from '../repositories/InMemoryProblemRepository';
import { buildSeedProblems } from './index';
import { DimensionMeta } from './rubricDimensions';

const problems = buildSeedProblems();

/**
 * Domain-specific words each problem's rubric text is required to mention.
 *
 * The point of the check below is that band text must be concrete about *this*
 * problem's vocabulary - generic phrases like "well-separated" measure nothing.
 * When a new problem is seeded, its vocabulary goes here.
 */
const DOMAIN_WORDS_BY_ID: Record<string, string[]> = {
  'parking-lot': ['spot', 'ticket', 'pricing', 'allocation'],
  'vending-machine': ['stock', 'payment', 'change', 'state'],
  'elevator-system': ['car', 'dispatch', 'motion', 'transition'],
  splitwise: ['split', 'expense', 'balance', 'rule'],
  'rate-limiter': ['algorithm', 'storage', 'rule', 'limit'],
  'notification-service': ['channel', 'template', 'event', 'preference'],
  'in-memory-cache': ['eviction', 'ttl', 'policy', 'storage'],
};

describe('seeded problem catalogue', () => {
  it('leads with the two problems the PRD names', () => {
    // The catalogue can grow, but Parking Lot and Vending Machine are the
    // canonical seeds and stay at the top of the list.
    expect(problems.slice(0, 2).map((problem) => problem.id)).toEqual([
      'parking-lot',
      'vending-machine',
    ]);
  });

  it('gives every seeded problem a unique id', () => {
    const ids = problems.map((problem) => problem.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('constructs without violating any domain invariant', () => {
    // Construction is the validation. Weights summing to 100, bands covering the
    // full scale and a change scenario naming a real dimension are all enforced
    // in constructors, so a malformed rubric fails at boot rather than midway
    // through a learner's evaluation.
    expect(() => buildSeedProblems()).not.toThrow();
  });

  it.each(problems)('$title states five HIGH requirements', (problem) => {
    expect(problem.requirements).toHaveLength(5);
    expect(problem.requirements.every((r) => r.importance === Importance.HIGH)).toBe(true);
    expect(new Set(problem.requirements.map((r) => r.id)).size).toBe(5);
  });

  it.each(problems)('$title weights four dimensions at 25% each', (problem) => {
    const { dimensions } = problem.rubric;

    expect(dimensions).toHaveLength(4);
    expect(dimensions.every((dimension) => dimension.weight === 25)).toBe(true);
    expect(dimensions.reduce((sum, d) => sum + d.weight, 0)).toBe(TOTAL_RUBRIC_WEIGHT);
  });

  it.each(problems)('$title uses the shared dimension ids', (problem) => {
    expect(problem.rubric.dimensionIds).toEqual([
      DimensionMeta.COHESION.id,
      DimensionMeta.COUPLING.id,
      DimensionMeta.COMPLETENESS.id,
      DimensionMeta.EXTENSIBILITY.id,
    ]);
  });

  it.each(problems)('$title describes every score on the 0-5 scale', (problem) => {
    for (const dimension of problem.rubric.dimensions) {
      for (let score = 0; score <= MAX_DIMENSION_SCORE; score += 1) {
        expect(() => dimension.bandFor(score)).not.toThrow();
      }
    }
  });

  it.each(problems)('$title writes band text specific to the problem', (problem) => {
    // Generic band text ("well separated") is not a standard anyone can be held
    // to. Each band should name something concrete from this problem's domain.
    const allBandText = problem.rubric.dimensions
      .flatMap((dimension) => dimension.bands.map((band) => band.descriptor))
      .join(' ')
      .toLowerCase();

    const domainWords = DOMAIN_WORDS_BY_ID[problem.id];
    expect(domainWords, `no domain-word list registered for ${problem.id}`).toBeDefined();

    for (const word of domainWords!) {
      expect(allBandText).toContain(word);
    }
  });

  it.each(problems)('$title unlocks a change scenario after attempt 1', (problem) => {
    const scenario = problem.changeScenario;

    expect(scenario).not.toBeNull();
    expect(scenario?.unlocksAfterAttempt).toBe(1);
    expect(problem.activeChangeScenarioFor(1)).toBeNull();
    expect(problem.activeChangeScenarioFor(2)?.id).toBe('CS-1');
  });

  it.each(problems)('$title routes its change scenario to Extensibility only', (problem) => {
    // Assumption A1. Routing it anywhere else, or treating it as a sixth
    // requirement, would make attempt 2 incomparable with attempt 1.
    expect(problem.changeScenario?.probesDimensionId).toBe(DimensionMeta.EXTENSIBILITY.id);
  });

  it('gives Parking Lot the EV charging scenario from the execution plan', () => {
    const parkingLot = problems[0];

    expect(parkingLot?.changeScenario?.title).toBe('EV charging spots');
    expect(parkingLot?.changeScenario?.description).toMatch(/electricity/i);
  });

  it('gives Vending Machine a scenario probing payment abstraction', () => {
    const vendingMachine = problems[1];

    expect(vendingMachine?.changeScenario?.description).toMatch(/UPI|card/i);
  });

  it('exercises a different design instinct in each problem', () => {
    // Parking Lot rewards separating things that change on different schedules;
    // Vending Machine is about state. Two problems teaching the same lesson
    // would be one problem seeded twice.
    const parkingLot = problems[0];
    const vendingMachine = problems[1];

    expect(parkingLot?.description.toLowerCase()).toMatch(/pricing|allocation/);
    expect(vendingMachine?.description.toLowerCase()).toMatch(/state|situation/);
  });
});

describe('InMemoryProblemRepository', () => {
  const repository = new InMemoryProblemRepository();

  it('lists the seeded problems', async () => {
    expect(await repository.findAll()).toHaveLength(problems.length);
  });

  it('finds a problem by id', async () => {
    const found = await repository.findById('parking-lot');

    expect(found?.title).toBe('Parking Lot');
    expect(found?.requirements).toHaveLength(5);
  });

  it('returns null for an unknown id rather than throwing', async () => {
    expect(await repository.findById('does-not-exist')).toBeNull();
  });

  it('orders requirements HIGH first for display', async () => {
    const problem = await repository.findById('vending-machine');

    expect(problem?.requirementsByImportance[0]?.importance).toBe(Importance.HIGH);
  });
});
