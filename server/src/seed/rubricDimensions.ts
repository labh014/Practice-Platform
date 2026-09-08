import { EvaluationDimension, EvaluationRubric, ScoreBand } from '../domain';

/**
 * The four axes every problem is judged on, per the execution plan.
 *
 * Ids, names and weights are shared so scores mean the same thing across
 * problems and the UI can render one consistent scorecard. The band text is
 * NOT shared - each problem supplies its own, because that is where the
 * standard becomes concrete enough to argue with.
 */
export const DimensionMeta = {
  COHESION: {
    id: 'responsibility-cohesion',
    name: 'Responsibility & Cohesion',
    weight: 25,
    description:
      'Whether each type has one reason to change, and whether responsibilities are ' +
      'split along the lines the problem actually varies on.',
  },
  COUPLING: {
    id: 'coupling-abstraction',
    name: 'Coupling & Abstraction Quality',
    weight: 25,
    description:
      'Whether dependencies point at abstractions where behaviour varies - and, ' +
      'equally, whether abstractions have been added where nothing varies.',
  },
  COMPLETENESS: {
    id: 'requirement-completeness',
    name: 'Requirement Completeness',
    weight: 25,
    description:
      'Whether every stated requirement has an identifiable home in the design, ' +
      'and whether exclusions are stated rather than silently dropped.',
  },
  EXTENSIBILITY: {
    id: 'extensibility-tradeoffs',
    name: 'Extensibility & Trade-offs',
    weight: 25,
    description:
      'Whether the next likely change is absorbed by adding types rather than ' +
      'editing existing ones, and whether the design owns its costs.',
  },
} as const;

export type DimensionKey = keyof typeof DimensionMeta;

/** The three described bands covering the 0-5 scale. */
export interface BandText {
  /** 0-1: absent, or fundamentally misapplied. */
  readonly low: string;
  /** 2-3: attempted, but inconsistent. Where a competent-but-unremarkable design lands. */
  readonly mid: string;
  /** 4-5: deliberate and justified. */
  readonly high: string;
}

/**
 * Builds a problem's rubric from its band text.
 *
 * The bands are the platform's main defence against grade inflation. An
 * evaluator asked to "rate cohesion out of 5" drifts upward, because praise is
 * its default register. An evaluator asked which of three written standards a
 * submission matches has to justify a 4 against a description - and a 2 becomes
 * a defined outcome rather than a reluctant one.
 *
 * They are also what makes a score explainable: the band text is shown to the
 * learner beside the number, so a 2/5 always arrives with the sentence saying
 * what a 2 means here.
 */
export function buildRubric(bands: Record<DimensionKey, BandText>): EvaluationRubric {
  const keys = Object.keys(DimensionMeta) as DimensionKey[];

  return new EvaluationRubric(
    keys.map((key) => {
      const meta = DimensionMeta[key];
      const text = bands[key];

      return new EvaluationDimension({
        id: meta.id,
        name: meta.name,
        description: meta.description,
        weight: meta.weight,
        bands: [
          new ScoreBand({ minScore: 0, maxScore: 1, descriptor: text.low }),
          new ScoreBand({ minScore: 2, maxScore: 3, descriptor: text.mid }),
          new ScoreBand({ minScore: 4, maxScore: 5, descriptor: text.high }),
        ],
      });
    }),
  );
}
