import type { DomainEvent, EventPublisher } from './event-publisher.js';

class NoopEventPublisher implements EventPublisher {
  async publish(_event: DomainEvent): Promise<void> {
    // TODO(events): Substituir por RabbitMQ publisher para processamento assíncrono pesado.
  }
}

export const eventPublisher: EventPublisher = new NoopEventPublisher();
