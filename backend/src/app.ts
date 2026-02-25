import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { authRouter } from './routes/auth.routes.js';
import { dashboardRouter } from './routes/dashboard.routes.js';
import { errorHandler, notFoundHandler } from './middlewares/error-handler.js';
import { requestIdMiddleware } from './middlewares/request-id.js';
import { healthRouter } from './routes/health.routes.js';

export const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(requestIdMiddleware);

app.use('/api', healthRouter);
app.use('/api/auth', authRouter);
app.use('/api', dashboardRouter);

app.use(notFoundHandler);
app.use(errorHandler);
