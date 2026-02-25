import type { Request, Response } from 'express';
import { env } from '../config/env.js';

export function healthController(_req: Request, res: Response) {
  res.status(200).json({
    status: 'ok',
    environment: env.nodeEnv,
    timestamp: new Date().toISOString(),
  });
}
