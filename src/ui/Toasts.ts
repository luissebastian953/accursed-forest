/** Transient notices (§8 panel 17). Pop in, fade out after a few seconds. */

import { html, render } from 'lit-html';
import { repeat } from 'lit-html/directives/repeat.js';

import { icon, type IconName } from './icons.ts';

export type ToastKind = 'info' | 'warn' | 'error';

interface Toast {
  id: number;
  text: string;
  kind: ToastKind;
}

const TONE: Record<ToastKind, string> = {
  info: 'border-[#f2e0b0] bg-[#fff6e0] text-[#4a3320]',
  warn: 'border-[#ffcf8f] bg-[#fff1d6] text-[#8a4b12]',
  error: 'border-[#ffb3a3] bg-[#ffe6e0] text-[#9e2e20]',
};

const MARK: Record<ToastKind, IconName> = {
  info: 'news',
  warn: 'fire',
  error: 'police-warning',
};

export class Toasts {
  private readonly root: HTMLElement;
  private readonly items: Toast[] = [];
  private nextId = 1;

  constructor(
    parent: HTMLElement,
    private readonly ttlMs = 4500,
  ) {
    this.root = document.createElement('div');
    this.root.className =
      'pointer-events-none absolute bottom-16 left-[30px] z-20 flex flex-col items-start gap-2';
    parent.appendChild(this.root);
  }

  push(text: string, kind: ToastKind = 'info'): void {
    const toast: Toast = { id: this.nextId++, text, kind };
    this.items.push(toast);
    if (this.items.length > 5) this.items.shift();
    this.render();
    setTimeout(() => {
      const index = this.items.indexOf(toast);
      if (index >= 0) this.items.splice(index, 1);
      this.render();
    }, this.ttlMs);
  }

  private render(): void {
    render(
      html`
        ${repeat(
          this.items,
          (toast) => toast.id,
          (toast) => html`
            <div
              class=${`toast-in flex max-w-[min(34rem,calc(100vw-4rem))] items-center gap-2 rounded-2xl border-2 px-3.5 py-2 text-sm font-bold shadow-[0_3px_0_rgba(217,196,141,0.9)] ${TONE[toast.kind]}`}
              data-testid="toast"
            >
              <span class="pill flex h-6 w-6 items-center justify-center">
                ${icon(MARK[toast.kind])}
              </span>
              <span>${toast.text}</span>
            </div>
          `,
        )}
      `,
      this.root,
    );
  }

  dispose(): void {
    this.root.remove();
  }
}
