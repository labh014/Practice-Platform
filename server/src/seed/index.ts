import type { Problem } from '../domain';
import { buildParkingLotProblem } from './parkingLot';
import { buildVendingMachineProblem } from './vendingMachine';

export { buildParkingLotProblem } from './parkingLot';
export { buildVendingMachineProblem } from './vendingMachine';
export { DimensionMeta, buildRubric, type DimensionKey, type BandText } from './rubricDimensions';

/**
 * The seeded problem catalogue.
 *
 * Built fresh on each call rather than held as a module-level constant, so a
 * test can never mutate the catalogue another test depends on. With two
 * problems the cost is nothing and the isolation is worth having.
 */
export function buildSeedProblems(): Problem[] {
  return [buildParkingLotProblem(), buildVendingMachineProblem()];
}
