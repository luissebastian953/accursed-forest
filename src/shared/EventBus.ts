import mitt, { type Emitter, type EventType } from 'mitt';

/**
 * The render/UI event bus (§10.2).
 *
 * `sim/` deliberately does NOT use this: the simulation returns an array of
 * `SimEvent`s from each tick and never emits. This bus is only for the layers
 * above the sim talking to each other through `app/`.
 */
export function createEventBus<T extends Record<EventType, unknown>>(): Emitter<T> {
  return mitt<T>();
}

export type { Emitter };
