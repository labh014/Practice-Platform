/**
 * The domain layer.
 *
 * These types know about LLD practice and nothing else - no Express, no Zod, no
 * OpenAI, no persistence. The dependency arrow points inward: evaluation,
 * repositories and the API all import from here, and nothing here imports back
 * out. That is what allows a second evaluator or a real database to arrive
 * later without any of these files changing.
 */
export * from './shared';
export * from './problem';
export * from './submission';
export * from './attempt';
export * from './evaluation';
