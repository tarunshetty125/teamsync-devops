import {
  DomainEntityType,
  DomainEventType,
} from "../enums/domain.enum";
import { RequestContext } from "../types/request-context";

export type DomainEvent = {
  type: DomainEventType;
  context: RequestContext;
  entityType: DomainEntityType;
  entityId: string;
  target?: {
    type: DomainEntityType;
    id: string;
  };
  metadata?: Record<string, unknown>;
  occurredAt: Date;
};

type DomainEventHandler = (event: DomainEvent) => Promise<void> | void;

type DomainEventFailure = {
  handlerIndex: number;
  error: unknown;
};

type DomainEventResult = {
  handlerCount: number;
  failures: DomainEventFailure[];
};

const handlers = new Map<DomainEventType, DomainEventHandler[]>();

export const registerDomainEventHandler = (
  type: DomainEventType,
  handler: DomainEventHandler
) => {
  const existingHandlers = handlers.get(type) || [];
  existingHandlers.push(handler);
  handlers.set(type, existingHandlers);

  return () => {
    const currentHandlers = handlers.get(type) || [];
    handlers.set(
      type,
      currentHandlers.filter((currentHandler) => currentHandler !== handler)
    );
  };
};

export const emitDomainEvent = async (
  event: DomainEvent
): Promise<DomainEventResult> => {
  const eventHandlers = handlers.get(event.type) || [];
  const failures: DomainEventFailure[] = [];

  await Promise.all(
    eventHandlers.map(async (handler, handlerIndex) => {
      try {
        await handler(event);
      } catch (error) {
        failures.push({ handlerIndex, error });
      }
    })
  );

  return {
    handlerCount: eventHandlers.length,
    failures,
  };
};

export const clearDomainEventHandlersForTest = () => {
  handlers.clear();
};
