import { InvalidProblemError } from '../shared/DomainError';
import type { RequirementId } from '../shared/ids';
import type { Importance } from './Importance';

/**
 * An explicit business rule the learner's design is expected to satisfy.
 *
 * Requirements are stated, addressable and stable. The evaluator is asked
 * whether the submission covers R1..Rn by id, which is what makes
 * "Requirement Completeness" a checkable dimension rather than an impression.
 */
export class Requirement {
  readonly id: RequirementId;
  readonly text: string;
  readonly importance: Importance;

  constructor(params: { id: RequirementId; text: string; importance: Importance }) {
    if (!params.id.trim()) {
      throw new InvalidProblemError('Requirement id must not be empty');
    }
    if (!params.text.trim()) {
      throw new InvalidProblemError(`Requirement ${params.id} must have text`);
    }

    this.id = params.id;
    this.text = params.text.trim();
    this.importance = params.importance;
  }
}
