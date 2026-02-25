import type { Request } from 'express';

export type RequestWithId = Request & { requestId?: string };

export type AuthenticatedRequest = RequestWithId & {
  authUserId?: string;
};
