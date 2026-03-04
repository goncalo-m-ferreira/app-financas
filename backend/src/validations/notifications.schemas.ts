import { z } from 'zod';
import { uuidSchema } from './common.schemas.js';

export const notificationParamSchema = z.object({
  notificationId: uuidSchema,
});
