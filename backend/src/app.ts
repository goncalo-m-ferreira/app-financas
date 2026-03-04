import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { authRouter } from './routes/auth.routes.js';
import { budgetsRouter } from './routes/budgets.routes.js';
import { reportsPublicDir } from './config/paths.js';
import { dashboardRouter } from './routes/dashboard.routes.js';
import { errorHandler, notFoundHandler } from './middlewares/error-handler.js';
import { requestIdMiddleware } from './middlewares/request-id.js';
import { healthRouter } from './routes/health.routes.js';
import { homeRouter } from './routes/home.routes.js';
import { notificationsRouter } from './routes/notifications.routes.js';
import { reportsRouter } from './routes/reports.routes.js';
import { authTransactionsRouter } from './routes/transactions.routes.js';
import { walletsRouter } from './routes/wallets.routes.js';

export const app = express();
const corsOrigins = [process.env.FRONTEND_URL, 'http://localhost:5173'].filter(
  (origin): origin is string => Boolean(origin),
);

app.use(helmet());
app.use(
  cors({
    origin: corsOrigins,
  }),
);
app.use(express.json());
app.use(requestIdMiddleware);
app.use('/reports', express.static(reportsPublicDir));

app.use('/api', healthRouter);
app.use('/api/auth', authRouter);
app.use('/api', dashboardRouter);
app.use('/api', budgetsRouter);
app.use('/api/transactions', authTransactionsRouter);
app.use('/api', walletsRouter);
app.use('/api', homeRouter);
app.use('/api', reportsRouter);
app.use('/api', notificationsRouter);

app.use(notFoundHandler);
app.use(errorHandler);
