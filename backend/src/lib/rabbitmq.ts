import amqp, { type Channel, type ConsumeMessage } from 'amqplib';
import { env } from '../config/env.js';

let channel: Channel | null = null;
let channelPromise: Promise<Channel> | null = null;

async function createChannel(): Promise<Channel> {
  const nextConnection = await amqp.connect(env.rabbitMqUrl);
  const nextChannel = await nextConnection.createChannel();

  channel = nextChannel;

  nextConnection.on('error', (error) => {
    console.error('[rabbitmq] connection error', error);
  });

  nextConnection.on('close', () => {
    channel = null;
    channelPromise = null;
  });

  nextChannel.on('error', (error) => {
    console.error('[rabbitmq] channel error', error);
  });

  nextChannel.on('close', () => {
    channel = null;
    channelPromise = null;
  });

  return nextChannel;
}

async function getChannel(): Promise<Channel> {
  if (channel) {
    return channel;
  }

  if (!channelPromise) {
    channelPromise = createChannel().finally(() => {
      channelPromise = null;
    });
  }

  return channelPromise;
}

export async function publishQueueMessage(queueName: string, payload: unknown): Promise<void> {
  const activeChannel = await getChannel();
  await activeChannel.assertQueue(queueName, { durable: true });

  const messageBuffer = Buffer.from(JSON.stringify(payload));
  const published = activeChannel.sendToQueue(queueName, messageBuffer, {
    persistent: true,
  });

  if (!published) {
    await new Promise<void>((resolve) => {
      activeChannel.once('drain', () => resolve());
    });
  }
}

export async function consumeQueueMessages(
  queueName: string,
  onMessage: (message: ConsumeMessage) => Promise<void>,
): Promise<void> {
  const activeChannel = await getChannel();
  await activeChannel.assertQueue(queueName, { durable: true });
  activeChannel.prefetch(1);

  await activeChannel.consume(queueName, async (message) => {
    if (!message) {
      return;
    }

    try {
      await onMessage(message);
      activeChannel.ack(message);
    } catch (error) {
      console.error('[rabbitmq] failed to process message', error);
      activeChannel.nack(message, false, false);
    }
  });
}
