/** Transient notices (§8 panel 17). Pop in, fade out after a few seconds. */

import { html, render } from 'lit-html';

export type ToastKind = 'info' | 'warn' | 'error';

interface Toast {
  id: number;
  text: string;
  kind: ToastKind;
}

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
      'pointer-events-none absolute bottom-4 left-1/2 z-20 flex -translate-x-1/2 flex-col items-center gap-2';
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
      html`${this.items.map(
        (toast) => html`
          <div
            class=${`rounded-lg px-4 py-2 text-sm text-white shadow-lg backdrop-blur ${
              toast.kind === 'error'
                ? 'bg-red-700/85'
                : toast.kind === 'warn'
                  ? 'bg-amber-700/85'
                  : 'bg-black/70'
            }`}
            data-testid="toast"
          >
            ${toast.text}
          </div>
        `,
      )}`,
      this.root,
    );
  }

  dispose(): void {
    this.root.remove();
  }
}
