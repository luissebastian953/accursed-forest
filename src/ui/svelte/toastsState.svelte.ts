/**
 * Transient notices (§8 panel 17): pop in, slide from the left, fade out
 * after a few seconds. The `Toasts` class keeps the exact constructor and
 * `push`/`dispose` surface it always had, so `App.ts` mounts and
 * drives it without knowing the rendering underneath changed.
 */

import { mount, unmount, type Component } from 'svelte';

import type { IconName } from '../icons.ts';

import ToastsView from './Toasts.svelte';

export type ToastKind = 'info' | 'warn' | 'error';

export interface ToastItem {
  id: number;
  text: string;
  kind: ToastKind;
}

export const TONE: Record<ToastKind, string> = {
  info: 'border-[#f2e0b0] bg-[#fff6e0] text-[#4a3320]',
  warn: 'border-[#ffcf8f] bg-[#fff1d6] text-[#8a4b12]',
  error: 'border-[#ffb3a3] bg-[#ffe6e0] text-[#9e2e20]',
};

export const MARK: Record<ToastKind, IconName> = {
  info: 'news',
  warn: 'fire',
  error: 'police-warning',
};

const state = $state<{ items: ToastItem[] }>({ items: [] });

/** Read from the `.svelte` template; mutated only through `Toasts.push`. */
export function toastState(): { items: ToastItem[] } {
  return state;
}

export class Toasts {
  private readonly target: HTMLElement;
  private readonly instance: ReturnType<Component>;
  private nextId = 1;

  constructor(
    parent: HTMLElement,
    private readonly ttlMs = 4500,
  ) {
    this.target = document.createElement('div');
    parent.appendChild(this.target);
    this.instance = mount(ToastsView, { target: this.target });
  }

  push(text: string, kind: ToastKind = 'info'): void {
    const toast: ToastItem = { id: this.nextId++, text, kind };
    state.items.push(toast);
    if (state.items.length > 5) state.items.shift();
    setTimeout(() => {
      const index = state.items.indexOf(toast);
      if (index >= 0) state.items.splice(index, 1);
    }, this.ttlMs);
  }

  dispose(): void {
    unmount(this.instance);
    this.target.remove();
  }
}
