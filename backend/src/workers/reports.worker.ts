import type { ConsumeMessage } from 'amqplib';
import { env } from '../config/env.js';
import { consumeQueueMessages } from '../lib/rabbitmq.js';
import { processReportJob, type ReportQueueMessage } from '../services/reports.service.js';

function parseQueueMessage(message: ConsumeMessage): ReportQueueMessage {
  let payload: unknown;

  try {
    payload = JSON.parse(message.content.toString('utf8'));
  } catch {
    throw new Error('Invalid JSON payload for report queue message.');
  }

  if (typeof payload !== 'object' || payload === null) {
    throw new Error('Invalid payload shape for report queue message.');
  }

  const reportId = Reflect.get(payload, 'reportId');
  const userId = Reflect.get(payload, 'userId');
  const month = Reflect.get(payload, 'month');
  const year = Reflect.get(payload, 'year');

  if (
    typeof reportId !== 'string' ||
    typeof userId !== 'string' ||
    typeof month !== 'number' ||
    typeof year !== 'number'
  ) {
    throw new Error('Missing required fields in report queue message.');
  }

  return {
    reportId,
    userId,
    month,
    year,
  };
}

export async function startReportsWorker(): Promise<void> {
  let isConnected = false;

  while (!isConnected) {
    try {
      await consumeQueueMessages(env.reportsQueueName, async (message) => {
        const payload = parseQueueMessage(message);
        await processReportJob(payload);
      });

      console.log(`[reports-worker] listening on queue "${env.reportsQueueName}"`);
      isConnected = true;
    } catch (error) {
      console.error('[reports-worker] failed to connect to RabbitMQ, retrying in 5s...', error);
      await new Promise<void>((resolve) => {
        setTimeout(resolve, 5000);
      });
    }
  }
}
