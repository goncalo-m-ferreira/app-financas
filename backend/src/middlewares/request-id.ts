import { randomUUID } from 'node:crypto';
import type { NextFunction, Response } from 'express';
import type { RequestWithId } from '../types/http.js';

export function requestIdMiddleware(req: RequestWithId, _res: Response, next: NextFunction) {
  req.requestId = randomUUID();
  _res.setHeader('x-request-id', req.requestId);
  next();
}
