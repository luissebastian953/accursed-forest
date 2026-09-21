import { mount, unmount, type Component } from 'svelte';

import { ToastPolicy } from '../../toastPolicy.ts';

import ToastsView from './Toasts.svelte';

export type ToastKind = 'info' | 'warn' | 'error';

export interface ToastItem {
  id: number;
  text: string;
  kind: ToastKind;
  /** The same notice happening again, counted rather than repeated. */
  repeat: number;
}

export const TONE: Record<ToastKind, string> = {
  info: 'border-[#f2e0b0] bg-[#fff6e0] text-[#4a3320]',
  warn: 'border-[#ffcf8f] bg-[#fff1d6] text-[#8a4b12]',
  error: 'border-[#ffb3a3] bg-[#ffe6e0] text-[#9e2e20]',
};

/** How many notices sit on screen at once; more than this and the oldest goes. */
const AT_ONCE = 3;

const state = $state<{ items: ToastItem[] }>({ items: [] });

/** Take one off, whether it ran out or was closed by hand. */
export function dismissToast(id: number): void {
  const index = state.items.findIndex((item) => item.id === id);

  if (index >= 0) state.items.splice(index, 1);
}

/** Read from the `.svelte` template; mutated only through `Toasts.push`. */
export function toastState(): { items: ToastItem[] } {
  return state;
}

export class Toasts {
  private readonly target: HTMLElement;
  private readonly instance: ReturnType<Component>;
  private nextId = 1;
  private readonly policy = new ToastPolicy();

  constructor(
    parent: HTMLElement,
    private readonly ttlMs = 4500,
  ) {
    this.target = document.createElement('div');
    parent.appendChild(this.target);
    this.instance = mount(ToastsView, { target: this.target });
  }

  push(text: string, kind: ToastKind = 'info'): void {
    const verdict = this.policy.offer(text, kind, Date.now(), state.items.length, AT_ONCE);

    if (verdict === 'drop') return;

    if (verdict === 'repeat') {
      const live = state.items.find((item) => item.text === text);

      if (live) {
        live.repeat += 1;
        return;
      }
    }

    const toast: ToastItem = { id: this.nextId++, text, kind, repeat: 1 };

    state.items.push(toast);

    while (state.items.length > AT_ONCE) {
      const gone = state.items.shift();

      if (gone) this.policy.forgetText(gone.text);
    }

    setTimeout(() => {
      this.policy.forgetText(toast.text);
      dismissToast(toast.id);
    }, this.ttlMs);
  }

  dispose(): void {
    unmount(this.instance);
    this.target.remove();
  }
}
