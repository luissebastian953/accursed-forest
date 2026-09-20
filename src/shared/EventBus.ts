import mitt, { type Emitter, type EventType } from 'mitt';

/** The render/UI event bus (GDD 10.2). `sim/` never emits: `tick()` returns its events. */
export function createEventBus<T extends Record<EventType, unknown>>(): Emitter<T> {
  return mitt<T>();
}

export type { Emitter };
