import type { Problem } from '../domain';
import { buildCacheProblem } from './cache';
import { buildElevatorProblem } from './elevator';
import { buildNotificationServiceProblem } from './notificationService';
import { buildParkingLotProblem } from './parkingLot';
import { buildRateLimiterProblem } from './rateLimiter';
import { buildSplitwiseProblem } from './splitwise';
import { buildVendingMachineProblem } from './vendingMachine';

export { buildParkingLotProblem } from './parkingLot';
export { buildVendingMachineProblem } from './vendingMachine';
export { buildElevatorProblem } from './elevator';
export { buildSplitwiseProblem } from './splitwise';
export { buildRateLimiterProblem } from './rateLimiter';
export { buildNotificationServiceProblem } from './notificationService';
export { buildCacheProblem } from './cache';
export { DimensionMeta, buildRubric, type DimensionKey, type BandText } from './rubricDimensions';

/**
 * The seeded problem catalogue.
 *
 * Built fresh on each call rather than held as a module-level constant, so a
 * test can never mutate the catalogue another test depends on. Order is the
 * order shown to learners: the two problems the PRD names come first, and
 * each additional problem is chosen to exercise a design instinct the others
 * do not.
 */
export function buildSeedProblems(): Problem[] {
  return [
    buildParkingLotProblem(),
    buildVendingMachineProblem(),
    buildElevatorProblem(),
    buildSplitwiseProblem(),
    buildRateLimiterProblem(),
    buildNotificationServiceProblem(),
    buildCacheProblem(),
  ];
}
