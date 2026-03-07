import { app } from './app.js';
import { startReportsWorker } from './workers/reports.worker.js';
import { startRecurringWorker } from './workers/recurring.worker.js';
const PORT = Number(process.env.PORT || 4010);
const safePort = Number.isFinite(PORT) && PORT > 0 ? PORT : 4010;

app.listen(safePort, '0.0.0.0', () => {
  console.log(`API a correr em http://0.0.0.0:${safePort}`);
});

void startReportsWorker().catch((error) => {
  console.error('[reports-worker] failed to start', error);
});

startRecurringWorker();
