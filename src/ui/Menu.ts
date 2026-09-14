/**
 * The menu (§8 panel 16): new estate, save, load. Export/import and settings
 * arrive with polish (M1h).
 */

import { html, nothing, render } from 'lit-html';

import { seedFromEstateCode } from '@sim/index';

export interface MenuView {
  estateCode: string;
  hasSave: boolean;
  lastSavedAt: string | null;
  saveError: string | null;
}

export interface MenuHandlers {
  newGame(seed: number): void;
  save(): void;
  load(): void;
}

export class Menu {
  private readonly root: HTMLElement;
  private open = false;
  private view: MenuView = { estateCode: '', hasSave: false, lastSavedAt: null, saveError: null };
  private codeInput = '';
  private codeError: string | null = null;

  constructor(
    parent: HTMLElement,
    private readonly handlers: MenuHandlers,
  ) {
    this.root = document.createElement('div');
    parent.appendChild(this.root);
  }

  get isOpen(): boolean {
    return this.open;
  }

  toggle(): void {
    this.open = !this.open;
    this.render();
  }

  show(): void {
    this.open = true;
    this.render();
  }

  hide(): void {
    this.open = false;
    this.render();
  }

  update(view: MenuView): void {
    this.view = view;
    this.render();
  }

  dispose(): void {
    this.root.remove();
  }

  private render(): void {
    if (!this.open) {
      render(nothing, this.root);
      return;
    }
    const v = this.view;
    render(
      html`
        <div
          class="absolute inset-0 z-30 flex items-center justify-center bg-black/50 p-4"
          @click=${(e: Event) => e.target === e.currentTarget && this.hide()}
        >
          <div
            class="w-full max-w-md rounded-2xl bg-neutral-900 p-6 text-white shadow-2xl"
            data-testid="menu"
          >
            <div class="mb-4 flex items-start justify-between">
              <div>
                <div class="text-lg font-semibold">Sawit Simulator</div>
                <div class="text-xs opacity-60">
                  Estate code <span class="font-mono">${v.estateCode}</span>
                </div>
              </div>
              <button
                class="rounded px-2 py-0.5 hover:bg-white/15"
                aria-label="Close"
                @click=${() => this.hide()}
              >
                ✕
              </button>
            </div>

            <div class="mb-5 grid grid-cols-2 gap-2">
              <button
                class="rounded bg-emerald-600 px-3 py-2 font-medium hover:bg-emerald-500"
                data-testid="menu-save"
                @click=${() => this.handlers.save()}
              >
                Save
              </button>
              <button
                class=${v.hasSave ? 'rounded bg-white/10 px-3 py-2 font-medium hover:bg-white/20' : 'rounded bg-white/5 px-3 py-2 opacity-40'}
                ?disabled=${!v.hasSave}
                data-testid="menu-load"
                @click=${() => this.handlers.load()}
              >
                Load
              </button>
            </div>
            <div class="mb-5 text-xs opacity-70">
              ${
                v.saveError
                  ? html`<span class="text-red-300">${v.saveError}</span>`
                  : v.lastSavedAt
                    ? html`Last saved ${new Date(v.lastSavedAt).toLocaleString()}`
                    : 'Not saved yet — autosave runs every 30 days.'
              }
            </div>

            <div class="border-t border-white/10 pt-4">
              <div class="mb-2 text-sm font-medium">New estate</div>
              <div class="flex gap-2">
                <input
                  class="min-w-0 flex-1 rounded bg-white/10 px-3 py-2 font-mono text-sm placeholder:opacity-40"
                  placeholder="Estate code (optional)"
                  .value=${this.codeInput}
                  @input=${(e: Event) => {
                    this.codeInput = (e.target as HTMLInputElement).value;
                    this.codeError = null;
                  }}
                />
                <button
                  class="rounded bg-white/10 px-3 py-2 font-medium hover:bg-white/20"
                  data-testid="menu-new"
                  @click=${() => this.startNew()}
                >
                  Start
                </button>
              </div>
              ${this.codeError ? html`<div class="mt-1 text-xs text-amber-200">${this.codeError}</div>` : nothing}
              <div class="mt-2 text-xs opacity-60">
                Leave the code empty for a random world. Starting a new estate replaces the current
                one.
              </div>
            </div>
          </div>
        </div>
      `,
      this.root,
    );
  }

  private startNew(): void {
    const trimmed = this.codeInput.trim();
    let seed: number;
    if (trimmed.length === 0) {
      const buffer = new Uint32Array(1);
      crypto.getRandomValues(buffer);
      seed = buffer[0]!;
    } else {
      const parsed = seedFromEstateCode(trimmed);
      if (parsed === null) {
        this.codeError = 'That is not an estate code. It looks like ABC-DEFG.';
        this.render();
        return;
      }
      seed = parsed;
    }
    this.codeInput = '';
    this.hide();
    this.handlers.newGame(seed);
  }
}
