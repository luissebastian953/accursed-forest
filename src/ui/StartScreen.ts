/**
 * The title screen (§8 panel 1, design kit "main start state"): a modal over
 * the live estate, pulled back so the terrain reads as a backdrop. Start a
 * game (or continue the saved one), enter a friend's estate code, open the
 * controls or the menu. On start the card fades and the camera pulls in on
 * the estate; the App owns that camera move.
 */

import { html, nothing, render } from 'lit-html';

import { GROWTH } from '@sim/balance/growth';
import { ECONOMY } from '@sim/balance/prices';

import { ENDING_COUNT } from './Epilogue.ts';
import { formatRp } from './format.ts';
import { icon } from './icons.ts';

export interface StartScreenView {
  /** The estate the game will start on. */
  estateCode: string;
  /** A saved estate to continue, if there is one. */
  savedCode: string | null;
}

export interface StartScreenHandlers {
  /** Start the current (or freshly coded) estate. */
  start(): void;
  /** Continue the saved estate. */
  resume(): void;
  /** Swap the current estate for the coded one; an error string if the code is bad. */
  useCode(code: string): string | null;
  howToPlay(): void;
  settings(): void;
}

const WORDS = ['One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
/** How long the fade takes; the App times the camera pull-in to match. */
export const START_FADE_MS = 650;

export class StartScreen {
  private readonly root: HTMLElement;
  private open = false;
  private leaving = false;
  private view: StartScreenView = { estateCode: '', savedCode: null };
  private code = '';
  private error: string | null = null;
  /** With a save to continue, the secondary button starts a fresh estate instead. */
  onNewEstate: (() => void) | null = null;

  constructor(
    parent: HTMLElement,
    private readonly handlers: StartScreenHandlers,
  ) {
    this.root = document.createElement('div');
    parent.appendChild(this.root);
  }

  get isOpen(): boolean {
    return this.open;
  }

  show(view: StartScreenView): void {
    this.view = view;
    this.open = true;
    this.leaving = false;
    this.error = null;
    this.render();
  }

  /** Fade out, then unmount. */
  dismiss(): void {
    if (!this.open || this.leaving) return;
    this.leaving = true;
    this.render();
    setTimeout(() => {
      this.open = false;
      this.leaving = false;
      this.render();
    }, START_FADE_MS);
  }

  dispose(): void {
    this.root.remove();
  }

  private submitCode(): void {
    const trimmed = this.code.trim();
    if (trimmed === '') {
      this.error = null;
      this.handlers.start();
      return;
    }
    this.error = this.handlers.useCode(trimmed);
    this.render();
  }

  private render(): void {
    if (!this.open) {
      render(nothing, this.root);
      return;
    }
    const v = this.view;
    // 540 growth-days is a year and a half in: the palms bear in year 2.
    const bearYear = Math.ceil(GROWTH.immatureDays / GROWTH.daysPerYear);
    const facts = [
      ['coin', `Start with ${formatRp(ECONOMY.startingCash)}`],
      ['shop-sapling', `Palms bear fruit in year ${bearYear}`],
      ['news', `${WORDS[ENDING_COUNT - 1] ?? ENDING_COUNT} ways it can end`],
    ] as const;

    render(
      html`
        <div
          class=${`start-screen absolute inset-0 z-50 flex items-center justify-center overflow-y-auto p-4 ${this.leaving ? 'start-out' : ''}`}
          data-testid="start-screen"
        >
          <div class="flex w-full max-w-xl flex-col items-center gap-3 text-center">
            <img
              class="h-20 w-20 drop-shadow-[0_6px_0_rgba(47,122,43,0.55)]"
              src=${`${import.meta.env.BASE_URL}brand/sawit-mark-transparent.svg`}
              width="80"
              height="80"
              alt=""
            />
            <span class="pill label !text-[var(--ink)] shadow-[0_3px_0_var(--card-shadow)]">
              A palm-oil farming sim
            </span>
            <h1
              class="title-extrude m-0 text-[clamp(3rem,9vw,5.5rem)] font-extrabold leading-[0.95]"
            >
              Sawit<br />Simulator
            </h1>
            <p class="card m-0 px-5 py-2 text-base font-extrabold">
              Turn wild land into a working estate. Every shortcut has a price.
            </p>

            <div class="card mt-2 flex w-full flex-col gap-3 p-5 text-left">
              ${
                v.savedCode
                  ? html`
                      <button
                        class="btn btn-coral btn-lg w-full !py-3 !text-xl uppercase tracking-wider"
                        data-testid="start-continue"
                        @click=${() => this.handlers.resume()}
                      >
                        Continue estate ${v.savedCode}
                      </button>
                      <button
                        class="btn btn-ghost w-full"
                        data-testid="start-game"
                        @click=${() => (this.onNewEstate ?? this.handlers.start)()}
                      >
                        Start a new estate
                      </button>
                    `
                  : html`
                      <button
                        class="btn btn-coral btn-lg w-full !py-3 !text-xl uppercase tracking-wider"
                        data-testid="start-game"
                        @click=${() => this.handlers.start()}
                      >
                        Start a game
                      </button>
                    `
              }
              <form
                class="flex gap-2"
                @submit=${(e: Event) => {
                  e.preventDefault();
                  this.submitCode();
                }}
              >
                <label class="pill flex min-w-0 flex-1 items-center gap-2 !py-2">
                  <span aria-hidden="true">🔒</span>
                  <input
                    class="min-w-0 flex-1 bg-transparent text-sm font-bold outline-none placeholder:text-[var(--ink-3)]"
                    placeholder="Estate code · e.g. ABC-DEFG"
                    data-testid="start-code"
                    .value=${this.code}
                    @input=${(e: Event) => {
                      this.code = (e.target as HTMLInputElement).value;
                    }}
                  />
                </label>
                <button class="btn btn-ghost" type="submit" data-testid="start-use-code">
                  Use code
                </button>
              </form>
              <p class="muted m-0 text-center text-xs font-bold">
                ${
                  this.error
                    ? html`<span class="text-[#9e2e20]">${this.error}</span>`
                    : html`Leave the code empty for a random world. Share a code to play the same
                        map as a friend. Yours is <b class="num">${v.estateCode}</b>.`
                }
              </p>
              <div class="border-t-2 border-dashed border-[var(--card-edge)]"></div>
              <div class="grid grid-cols-2 gap-2">
                <button
                  class="btn btn-ghost"
                  data-testid="start-help"
                  @click=${() => this.handlers.howToPlay()}
                >
                  ? How to play
                </button>
                <button
                  class="btn btn-ghost"
                  data-testid="start-settings"
                  @click=${() => this.handlers.settings()}
                >
                  ⚙ Settings
                </button>
              </div>
            </div>

            <div class="mt-1 flex flex-wrap justify-center gap-2 text-xs font-extrabold">
              ${facts.map(
                ([name, text]) => html`
                  <span class="card flex items-center gap-1.5 !rounded-xl px-3 py-1.5">
                    ${icon(name)} ${text}
                  </span>
                `,
              )}
            </div>
          </div>
        </div>
      `,
      this.root,
    );
  }
}
