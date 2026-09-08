import { InvalidProblemError } from '../shared/DomainError';
import type { ProblemId, RequirementId } from '../shared/ids';
import type { ChangeScenario } from './ChangeScenario';
import type { EvaluationRubric } from './EvaluationRubric';
import { compareImportance } from './Importance';
import type { Requirement } from './Requirement';

/**
 * An LLD exercise: what to design, what it must do, and how it will be judged.
 *
 * A Problem owns its requirements, its rubric and its optional change scenario.
 * Nothing about how a submission gets evaluated lives here - the Problem states
 * the standard, and the evaluation layer applies it. That separation is what
 * lets a second evaluator strategy appear later without the problem definitions
 * changing at all.
 *
 * Note there are no `requiredKeywords`. Keyword matching would reward learners
 * for typing the word "factory" rather than for designing well, which is
 * exactly the failure mode this platform exists to avoid.
 */
export class Problem {
  readonly id: ProblemId;
  readonly title: string;
  readonly summary: string;
  readonly description: string;
  readonly requirements: readonly Requirement[];
  readonly rubric: EvaluationRubric;
  readonly changeScenario: ChangeScenario | null;

  private readonly requirementsById: ReadonlyMap<RequirementId, Requirement>;

  constructor(params: {
    id: ProblemId;
    title: string;
    summary: string;
    description: string;
    requirements: Requirement[];
    rubric: EvaluationRubric;
    changeScenario?: ChangeScenario | null;
  }) {
    const { id, title, summary, description, requirements, rubric } = params;
    const changeScenario = params.changeScenario ?? null;

    if (!id.trim()) {
      throw new InvalidProblemError('Problem id must not be empty');
    }
    if (!title.trim()) {
      throw new InvalidProblemError(`Problem ${id} must have a title`);
    }
    if (!summary.trim()) {
      throw new InvalidProblemError(`Problem ${id} must have a summary`);
    }
    if (!description.trim()) {
      throw new InvalidProblemError(`Problem ${id} must have a description`);
    }
    if (requirements.length === 0) {
      throw new InvalidProblemError(`Problem ${id} must define at least one requirement`);
    }

    const requirementsById = new Map<RequirementId, Requirement>();
    for (const requirement of requirements) {
      if (requirementsById.has(requirement.id)) {
        throw new InvalidProblemError(
          `Duplicate requirement id ${requirement.id} in problem ${id}`,
        );
      }
      requirementsById.set(requirement.id, requirement);
    }

    // A scenario that probes a dimension the rubric does not define would be
    // scored into a void, so this is caught at construction rather than at
    // evaluation time.
    if (changeScenario && !rubric.has(changeScenario.probesDimensionId)) {
      throw new InvalidProblemError(
        `Change scenario ${changeScenario.id} probes dimension ` +
          `${changeScenario.probesDimensionId}, which problem ${id} does not define`,
      );
    }

    this.id = id;
    this.title = title.trim();
    this.summary = summary.trim();
    this.description = description.trim();
    this.requirements = Object.freeze([...requirements]);
    this.rubric = rubric;
    this.changeScenario = changeScenario;
    this.requirementsById = requirementsById;
  }

  /** Requirements ordered HIGH first, for display and for prompt construction. */
  get requirementsByImportance(): Requirement[] {
    return [...this.requirements].sort((a, b) => compareImportance(a.importance, b.importance));
  }

  findRequirement(requirementId: RequirementId): Requirement | undefined {
    return this.requirementsById.get(requirementId);
  }

  /**
   * The change scenario applying to the given attempt, or null.
   *
   * Single source of truth for the unlock rule. The prompt builder, the API
   * layer and the UI all ask this rather than re-deriving it, so the learner
   * can never see a scenario the evaluator did not consider, or the reverse.
   */
  activeChangeScenarioFor(attemptNumber: number): ChangeScenario | null {
    if (!this.changeScenario) return null;
    return this.changeScenario.isActiveForAttempt(attemptNumber) ? this.changeScenario : null;
  }

  /** Whether the scenario should be revealed in the UI at this point. */
  hasRevealedChangeScenario(latestAttemptNumber: number): boolean {
    if (!this.changeScenario) return false;
    return latestAttemptNumber >= this.changeScenario.unlocksAfterAttempt;
  }
}
