import { env } from '../config/env.js';
import { runRecurringMaterializationCycle } from '../services/recurring-execution.service.js';

let isRunning = false;
let loopHandle: NodeJS.Timeout | null = null;

async function executeCycle(): Promise<void> {
  if (isRunning) {
    return;
  }

  isRunning = true;

  try {
    const summary = await runRecurringMaterializationCycle({
      retryBackoffMs: env.recurringRetryBackoffMs,
    });

    if (summary.attempts > 0) {
      console.log(
        `[recurring-worker] cycle attempts=${summary.attempts} success=${summary.successes} idempotent=${summary.idempotentReplays} transient=${summary.transientFailures} structural=${summary.structuralFailures}`,
      );
    }
  } catch (error) {
    console.error('[recurring-worker] cycle failed', error);
  } finally {
    isRunning = false;
  }
}

export function startRecurringWorker(): void {
  if (!env.recurringWorkerEnabled) {
    console.log('[recurring-worker] disabled (set RECURRING_WORKER_ENABLED=true to enable)');
    return;
  }

  if (loopHandle) {
    return;
  }

  void executeCycle();

  loopHandle = setInterval(() => {
    void executeCycle();
  }, env.recurringWorkerIntervalMs);

  console.log(`[recurring-worker] started with interval=${env.recurringWorkerIntervalMs}ms`);
}
