import { Router } from 'express';

import type { AttemptService } from '../application/AttemptService';
import type { ProblemService } from '../application/ProblemService';
import type { EvaluatorInfo } from '../container';
import {
  toAttemptDto,
  toAttemptSummaryDto,
  toProblemDto,
  toProblemSummaryDto,
} from './dto/mappers';
import type { SubmitAttemptResponseDto } from './dto/types';
import { asyncHandler, respond } from './errorMiddleware';
import { SubmitAttemptRequestSchema, UserQuerySchema, validate } from './validation';

/**
 * The REST surface, as specified in the PRD plus the two routes it needs to be
 * complete: problem detail, so the workspace survives a page refresh, and
 * retry, without which FAILED is a state with no exit.
 */
export function createRouter(services: {
  attempts: AttemptService;
  problems: ProblemService;
  evaluator: EvaluatorInfo;
}): Router {
  const router = Router();

  // Reports which evaluator is answering, so the client can say so rather than
  // letting rule-based feedback pass for a model reading the design.
  router.get('/health', (_req, res) => {
    res.json({ status: 'ok', evaluator: services.evaluator });
  });

  router.get(
    '/problems',
    asyncHandler(async (req, res) => {
      const query = validate(UserQuerySchema, req.query);
      if (!query.ok) {
        respond(res, 400, 'INVALID_REQUEST', 'Invalid query parameters', query.issues);
        return;
      }

      const withProgress = await services.problems.listWithProgress(query.value.userId);

      res.json(
        withProgress.map((entry) => toProblemSummaryDto(entry.problem, entry.attempts)),
      );
    }),
  );

  router.get(
    '/problems/:problemId',
    asyncHandler(async (req, res) => {
      const query = validate(UserQuerySchema, req.query);
      if (!query.ok) {
        respond(res, 400, 'INVALID_REQUEST', 'Invalid query parameters', query.issues);
        return;
      }

      const problemId = req.params['problemId'] ?? '';
      const problem = await services.problems.getById(problemId);

      // The attempt count decides whether the change scenario is sent at all.
      const latestAttemptNumber = await services.problems.latestAttemptNumber(
        problemId,
        query.value.userId,
      );

      res.json(toProblemDto(problem, latestAttemptNumber));
    }),
  );

  router.get(
    '/problems/:problemId/attempts',
    asyncHandler(async (req, res) => {
      const query = validate(UserQuerySchema, req.query);
      if (!query.ok) {
        respond(res, 400, 'INVALID_REQUEST', 'Invalid query parameters', query.issues);
        return;
      }

      const attempts = await services.attempts.listForProblem(
        req.params['problemId'] ?? '',
        query.value.userId,
      );

      res.json(attempts.map(toAttemptSummaryDto));
    }),
  );

  router.post(
    '/attempts',
    asyncHandler(async (req, res) => {
      const parsed = validate(SubmitAttemptRequestSchema, req.body);
      if (!parsed.ok) {
        respond(res, 400, 'INVALID_REQUEST', 'Invalid submission', parsed.issues);
        return;
      }

      const attempt = await services.attempts.submit(parsed.value);

      const body: SubmitAttemptResponseDto = {
        attemptId: attempt.id,
        status: attempt.status,
        attemptNumber: attempt.attemptNumber,
      };

      // 202: stored and acknowledged, evaluation still to come. The learner's
      // work being safe and the learner's work being graded are two different
      // guarantees, and the status code should say which one has been met.
      res.status(202).json(body);
    }),
  );

  router.get(
    '/attempts/:attemptId',
    asyncHandler(async (req, res) => {
      const attempt = await services.attempts.getById(req.params['attemptId'] ?? '');
      const problem = await services.problems.getById(attempt.problemId);

      res.json(toAttemptDto(attempt, problem.rubric));
    }),
  );

  router.post(
    '/attempts/:attemptId/retry',
    asyncHandler(async (req, res) => {
      const attempt = await services.attempts.retry(req.params['attemptId'] ?? '');

      const body: SubmitAttemptResponseDto = {
        attemptId: attempt.id,
        status: attempt.status,
        attemptNumber: attempt.attemptNumber,
      };

      res.status(202).json(body);
    }),
  );

  return router;
}
