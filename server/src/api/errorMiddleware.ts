import type { NextFunction, Request, Response } from 'express';

import { ConflictError, NotFoundError } from '../application/errors';
import { DomainError } from '../domain';
import type { ApiErrorDto } from './dto/types';

/**
 * Translates thrown errors into responses.
 *
 * The mapping is by error type rather than by an HTTP status carried around the
 * codebase, so the application and domain layers never have to know they are
 * behind HTTP. A domain invariant that a caller violated is a 400 - the request
 * asked for something the model does not permit - while anything unrecognised
 * is a 500 and is logged, because an unclassified error is a bug rather than a
 * client mistake.
 */
export function errorMiddleware(
  error: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (error instanceof NotFoundError) {
    respond(res, 404, 'NOT_FOUND', error.message);
    return;
  }

  if (error instanceof ConflictError) {
    respond(res, 409, 'CONFLICT', error.message);
    return;
  }

  if (error instanceof DomainError) {
    respond(res, 400, 'INVALID_REQUEST', error.message);
    return;
  }

  const message = error instanceof Error ? error.message : String(error);
  console.error('[api] unhandled error:', error);
  respond(res, 500, 'INTERNAL_ERROR', message);
}

export function notFoundHandler(_req: Request, res: Response): void {
  respond(res, 404, 'NOT_FOUND', 'No such endpoint');
}

export function respond(
  res: Response,
  status: number,
  code: string,
  message: string,
  details?: unknown,
): void {
  const body: ApiErrorDto = {
    error: details === undefined ? { code, message } : { code, message, details },
  };

  res.status(status).json(body);
}

/**
 * Wraps an async handler so a rejected promise reaches the error middleware.
 *
 * Express 4 does not await handlers, so without this a rejection becomes an
 * unhandled promise rejection and the client waits until it times out.
 */
export function asyncHandler(
  handler: (req: Request, res: Response) => Promise<void>,
): (req: Request, res: Response, next: NextFunction) => void {
  return (req, res, next) => {
    handler(req, res).catch(next);
  };
}
