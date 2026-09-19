import type { SimState } from '@sim/types';

import type { DirtyChunks, SaveSlot } from './chunks.ts';

export interface AutosaveOptions {
  slot: SaveSlot;
  getState: () => SimState;
  dirty: DirtyChunks;
  /** Sim days between autosaves (§7: 30). */
  everyTicks?: number;
  onSaved?: (keysWritten: string[]) => void;
  onError?: (error: unknown) => void;
}

export class Autosave {
  private readonly slot: SaveSlot;
  private readonly getState: () => SimState;
  private readonly dirty: DirtyChunks;
  private readonly everyTicks: number;
  private readonly onSaved: ((keys: string[]) => void) | undefined;
  private readonly onError: ((error: unknown) => void) | undefined;
  private needsFullWrite = true;

  constructor(options: AutosaveOptions) {
    this.slot = options.slot;
    this.getState = options.getState;
    this.dirty = options.dirty;
    this.everyTicks = options.everyTicks ?? 30;
    this.onSaved = options.onSaved;
    this.onError = options.onError;
  }

  /** Call once per sim tick. */
  onTick(tick: number): void {
    if (tick > 0 && tick % this.everyTicks === 0) this.saveNow();
  }

  /** Returns true if the write succeeded. */
  saveNow(): boolean {
    const taken = this.needsFullWrite ? null : this.dirty.take();
    try {
      const keys = this.slot.save(this.getState(), taken ?? 'all');
      if (taken === null) this.dirty.take();
      this.needsFullWrite = false;
      this.onSaved?.(keys);
      return true;
    } catch (error) {
      if (taken) this.dirty.restore(taken);
      this.onError?.(error);
      return false;
    }
  }

  /**
   * Save when the page is hidden or unloading. Returns a detach function.
   * Browser-only; harmless to skip in tests.
   */
  attach(
    target: Pick<Window, 'addEventListener' | 'removeEventListener'> & {
      document?: Document;
    } = window,
  ): () => void {
    const onVisibility = (): void => {
      if (target.document?.visibilityState === 'hidden') this.saveNow();
    };
    const onUnload = (): void => {
      this.saveNow();
    };
    target.document?.addEventListener('visibilitychange', onVisibility);
    target.addEventListener('beforeunload', onUnload);
    return () => {
      target.document?.removeEventListener('visibilitychange', onVisibility);
      target.removeEventListener('beforeunload', onUnload);
    };
  }
}
