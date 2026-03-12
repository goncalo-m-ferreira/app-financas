import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { adminRouter } from './routes/admin.routes.js';
import { authRouter } from './routes/auth.routes.js';
import { budgetsRouter } from './routes/budgets.routes.js';
import { env } from './config/env.js';
import { dashboardRouter } from './routes/dashboard.routes.js';
import { requireCsrfForCookieSession } from './middlewares/csrf.js';
import { errorHandler, notFoundHandler } from './middlewares/error-handler.js';
import { requestIdMiddleware } from './middlewares/request-id.js';
import { healthRouter } from './routes/health.routes.js';
import { homeRouter } from './routes/home.routes.js';
import { notificationsRouter } from './routes/notifications.routes.js';
import { recurringRulesRouter } from './routes/recurring-rules.routes.js';
import { reportsRouter } from './routes/reports.routes.js';
import { authTransactionsRouter } from './routes/transactions.routes.js';
import { usersRouter } from './routes/users.routes.js';
import { walletsRouter } from './routes/wallets.routes.js';

export const app = express();

if (env.trustProxy) {
  app.set('trust proxy', 1);
}

app.use(helmet());
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) {
        callback(null, true);
        return;
      }

      const normalizedOrigin = origin.trim().replace(/\/+$/, '');
      const isAllowed = env.allowedCorsOrigins.includes(normalizedOrigin);

      callback(null, isAllowed);
    },
    credentials: true,
  }),
);
app.use(express.json());
app.use(requestIdMiddleware);

app.use('/api', healthRouter);
app.use('/api/auth', authRouter);
app.use('/api', requireCsrfForCookieSession);
app.use('/api', adminRouter);
app.use('/api', dashboardRouter);
app.use('/api', budgetsRouter);
app.use('/api/transactions', authTransactionsRouter);
app.use('/api', walletsRouter);
app.use('/api', homeRouter);
app.use('/api', reportsRouter);
app.use('/api', notificationsRouter);
app.use('/api', recurringRulesRouter);
app.use('/api', usersRouter);

app.use(notFoundHandler);
app.use(errorHandler);
