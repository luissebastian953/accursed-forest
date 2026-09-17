/**
 * The title screen (§8 panel 1, design kit 5a): a modal over the live estate,
 * pulled back so the terrain reads as a dimmed backdrop. Two states:
 *
 *   - first launch, or nothing saved in this browser: the large start card;
 *     Start a game, an estate code to share a world, How to play, Settings,
 *     and three facts drawn from the balance tables;
 *   - a save in this browser: the medium "welcome back" card; the estate,
 *     when it was saved, where it stands, what is going on there, Continue,
 *     and the ways out (the menu's saves and codes, or a new estate).
 *
 * On start or continue the card fades and the camera pulls in; the App owns
 * that camera move.
 */

import { html, nothing, render, type TemplateResult } from 'lit-html';

import { GROWTH } from '@sim/balance/growth';
import { ECONOMY } from '@sim/balance/prices';

import { ENDING_COUNT } from './Epilogue.ts';
import { formatRp } from './format.ts';
import { icon, type IconName } from './icons.ts';

/** What the welcome-back card says about the save. */
export interface SaveSummary {
  code: string;
  /** ISO timestamp of the last save, if the manifest has one. */
  savedAt: string | null;
  year: number;
  day: number;
  plantedHectares: number;
  cash: number;
  /** What is going on there: weather events, pests, the checklist. */
  chips: {
    icon: IconName;
    label: string;
    tone: 'fire' | 'smoke' | 'ash' | 'water' | 'dry' | 'pest' | 'econ' | 'plain';
  }[];
}

export interface StartScreenView {
  /** The estate a fresh start would open on. */
  estateCode: string;
  /** The saved estate to continue, if there is one. */
  save: SaveSummary | null;
  /** The footer line: version and renderer. */
  build: string;
}

export interface StartScreenHandlers {
  /** Start the current (or freshly coded) estate. */
  start(): void;
  /** Continue the saved estate. */
  resume(): void;
  /** Leave the save behind and start a random new estate. */
  newEstate(): void;
  /** The menu: saves and estate codes. */
  loadOther(): void;
  /** Swap the current estate for the coded one; an error string if the code is bad. */
  useCode(code: string): string | null;
  howToPlay(): void;
  settings(): void;
}

const WORDS = ['One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
/** How long the fade takes; the App times the camera pull-in to match. */
export const START_FADE_MS = 650;

const CHIP_TONE: Record<SaveSummary['chips'][number]['tone'], string> = {
  fire: 'chip-fire',
  smoke: 'chip-smoke',
  ash: 'chip-ash',
  water: 'chip-water',
  dry: 'chip-dry',
  pest: 'chip-pest',
  econ: 'chip-econ',
  plain: 'chip-cream',
};

/** "Saved today 15:28", or the date for older saves. */
function savedLabel(iso: string | null): string {
  if (!iso) return 'Saved';
  const when = new Date(iso);
  if (Number.isNaN(when.getTime())) return 'Saved';
  const now = new Date();
  const time = when.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  if (when.toDateString() === now.toDateString()) return `Saved today ${time}`;
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (when.toDateString() === yesterday.toDateString()) return `Saved yesterday ${time}`;
  return `Saved ${when.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} ${time}`;
}

export class StartScreen {
  private readonly root: HTMLElement;
  private open = false;
  private leaving = false;
  private view: StartScreenView = { estateCode: '', save: null, build: '' };
  private code = '';
  private error: string | null = null;

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

  private title(large: boolean): TemplateResult {
    return large
      ? html`
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
          <h1 class="title-extrude m-0 text-[clamp(3rem,9vw,5.5rem)] font-extrabold leading-[0.95]">
            Sawit<br />Simulator
          </h1>
          <p class="card m-0 px-5 py-2 text-base font-extrabold">
            Turn wild land into a working estate. Every shortcut has a price.
          </p>
        `
      : html`<h1 class="title-extrude m-0 text-[clamp(2rem,5vw,3rem)] font-extrabold">
          Sawit Simulator
        </h1>`;
  }

  /** First launch: the large start card. */
  private startCard(v: StartScreenView): TemplateResult {
    const bearYear = Math.ceil(GROWTH.immatureDays / GROWTH.daysPerYear);
    const facts = [
      ['coin', `Start with ${formatRp(ECONOMY.startingCash)}`],
      ['shop-sapling', `Palms bear fruit in year ${bearYear}`],
      ['news', `${WORDS[ENDING_COUNT - 1] ?? ENDING_COUNT} ways it can end`],
    ] as const;
    return html`
      <div class="card mt-2 flex w-full flex-col gap-3 p-5 text-left">
        <button
          class="btn btn-coral btn-lg w-full !py-3 !text-xl uppercase tracking-wider"
          data-testid="start-game"
          @click=${() => this.handlers.start()}
        >
          Start a game
        </button>
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
              placeholder="Estate code, e.g. ABC-DEFG"
              data-testid="start-code"
              .value=${this.code}
              @input=${(e: Event) => {
                this.code = (e.target as HTMLInputElement).value;
              }}
            />
          </label>
          <button class="btn btn-ghost" type="submit" data-testid="start-use-code">Use code</button>
        </form>
        <p class="muted m-0 text-center text-xs font-bold">
          ${
            this.error
              ? html`<span class="text-[#9e2e20]">${this.error}</span>`
              : html`Leave the code empty for a random world. Share a code to play the same map as a
                  friend. Yours is <b class="num">${v.estateCode}</b>.`
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
    `;
  }

  /** A save in this browser: the medium welcome-back card. */
  private continueCard(save: SaveSummary): TemplateResult {
    return html`
      <div
        class="card mt-4 flex w-full max-w-lg flex-col gap-3 p-5 text-left"
        data-testid="start-welcome"
      >
        <div class="label">Welcome back</div>
        <div
          class="flex flex-col gap-3 rounded-2xl border-2 border-[var(--green)] bg-[#e9f7e2] p-4"
        >
          <div class="flex items-center gap-3">
            <span
              class="flex h-16 w-16 flex-none items-center justify-center rounded-2xl border-2 border-[var(--green-edge)] bg-white"
            >
              ${icon('shop-sapling', 'icon-lg !h-9 !w-9')}
            </span>
            <div class="min-w-0">
              <div class="flex flex-wrap items-center gap-2">
                <span class="text-xl font-extrabold text-[var(--green-edge)]">
                  Estate <span class="num">${save.code}</span>
                </span>
                <span class="pill label !py-0.5 !text-[var(--green-edge)]"
                  >${savedLabel(save.savedAt)}</span
                >
              </div>
              <div class="num text-sm font-extrabold">
                Year ${save.year}, Day ${save.day}, ${save.plantedHectares} ha planted,
                ${formatRp(save.cash)}
              </div>
            </div>
          </div>
          ${
            save.chips.length > 0
              ? html`<div class="flex flex-wrap gap-1.5 text-xs">
                  ${save.chips.map(
                    (chip) =>
                      html`<span class=${`chip ${CHIP_TONE[chip.tone]}`}>
                        ${icon(chip.icon)} ${chip.label}
                      </span>`,
                  )}
                </div>`
              : nothing
          }
          <button
            class="btn btn-green btn-lg w-full !py-3 !text-xl uppercase tracking-wider"
            data-testid="start-continue"
            @click=${() => this.handlers.resume()}
          >
            ▸ Continue
          </button>
        </div>
        <div class="grid grid-cols-2 gap-2">
          <button
            class="btn btn-ghost"
            data-testid="start-load-other"
            @click=${() => this.handlers.loadOther()}
          >
            Saves &amp; codes
          </button>
          <button
            class="btn btn-coral"
            data-testid="start-game"
            @click=${() => this.handlers.newEstate()}
          >
            New estate
          </button>
        </div>
        <p class="muted m-0 text-center text-xs font-bold">
          There is one save slot: starting a new estate replaces this one.
        </p>
      </div>
    `;
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
          class=${`start-screen absolute inset-0 z-50 flex items-center justify-center overflow-y-auto p-4 ${this.leaving ? 'start-out' : ''}`}
          data-testid="start-screen"
          data-mode=${v.save ? 'continue' : 'start'}
        >
          <div class="flex w-full max-w-xl flex-col items-center gap-3 text-center">
            ${this.title(v.save === null)} ${v.save ? this.continueCard(v.save) : this.startCard(v)}
          </div>
          <div class="label absolute bottom-3 left-4 !text-[#fff6e0] opacity-80">${v.build}</div>
        </div>
      `,
      this.root,
    );
  }
}
