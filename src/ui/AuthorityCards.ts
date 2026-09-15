/**
 * The authorities' paperwork (§8 panel 17b) and the end of the road (§3.9):
 * the letter, the investigation notice with its "settle the matter" option
 * when integrity allows, and the arrest card.
 */

import { html, nothing, render } from 'lit-html';

import type { NewsItem, Rejection } from '@sim/types';

import { formatDate, formatRp } from './format.ts';

export type CardKind = 'letter' | 'investigation' | 'arrest';

export interface CardView {
  kind: CardKind;
  tick: number;
  headline: NewsItem | null;
  /** Investigation only: when the ban lifts. */
  until: number | null;
  settleCost: number | null;
  settleRejection: Rejection | null;
  /** Arrest only: the run's paper trail. */
  letters: number;
  recent: readonly NewsItem[];
}

export interface CardHandlers {
  dismiss(): void;
  settle(): void;
  newEstate(): void;
}

export class AuthorityCards {
  private readonly root: HTMLElement;
  private view: CardView | null = null;

  constructor(
    parent: HTMLElement,
    private readonly handlers: CardHandlers,
  ) {
    this.root = document.createElement('div');
    parent.appendChild(this.root);
  }

  get showing(): CardKind | null {
    return this.view?.kind ?? null;
  }

  show(view: CardView): void {
    this.view = view;
    this.render();
  }

  hide(): void {
    this.view = null;
    this.render();
  }

  dispose(): void {
    this.root.remove();
  }

  private render(): void {
    const v = this.view;
    if (!v) {
      render(nothing, this.root);
      return;
    }
    render(
      html`
        <div class="absolute inset-0 z-40 flex items-center justify-center bg-black/55 p-4">
          <div
            class=${`w-full max-w-lg rounded-2xl p-6 text-white shadow-2xl ${v.kind === 'arrest' ? 'bg-neutral-950' : 'bg-stone-900'}`}
            data-testid=${`card-${v.kind}`}
          >
            ${v.kind === 'letter' ? this.letter(v) : v.kind === 'investigation' ? this.investigation(v) : this.arrest(v)}
          </div>
        </div>
      `,
      this.root,
    );
  }

  private letter(v: CardView) {
    return html`
      <div class="mb-1 text-xs uppercase tracking-widest text-amber-300">
        District office · ${formatDate(v.tick)}
      </div>
      <div class="mb-3 text-lg font-semibold">Summons: cease land clearing pending review</div>
      <p class="mb-3 text-sm leading-relaxed opacity-85">
        The office has taken note of clearing on your estate. Until the matter is reviewed, every
        clearing crew you hire will cost half again. Burn again, or reach into land that is not
        yours, and the police will be the next to call.
      </p>
      <p class="mb-5 text-xs opacity-60">
        Attention falls with quiet seasons, and faster if you plant forest back.
      </p>
      <button
        class="w-full rounded bg-amber-600 px-3 py-2 font-medium hover:bg-amber-500"
        data-testid="card-dismiss"
        @click=${() => this.handlers.dismiss()}
      >
        Noted
      </button>
    `;
  }

  private investigation(v: CardView) {
    return html`
      <div class="mb-1 text-xs uppercase tracking-widest text-red-300">
        Regional police · ${formatDate(v.tick)}
      </div>
      <div class="mb-3 text-lg font-semibold">
        ${v.headline?.title ?? 'Police open an investigation'}
      </div>
      <p class="mb-3 text-sm leading-relaxed opacity-85">${v.headline?.body ?? ''}</p>
      <ul class="mb-4 space-y-1 text-sm">
        <li>
          🚫 No chopping or burning until
          <strong>${v.until !== null ? formatDate(v.until) : '—'}</strong>.
        </li>
        <li>✅ Harvests and sales continue.</li>
        <li>⚠️ A second wildfire while the police are here is an arrest.</li>
      </ul>
      <div class="flex flex-col gap-2">
        ${
          v.settleRejection === null && v.settleCost !== null
            ? html`
                <button
                  class="w-full rounded bg-neutral-700 px-3 py-2 text-left hover:bg-neutral-600"
                  data-testid="card-settle"
                  @click=${() => this.handlers.settle()}
                >
                  <span class="flex justify-between gap-2">
                    <span>Settle the matter</span>
                    <span class="tabular-nums opacity-80">${formatRp(v.settleCost)}</span>
                  </span>
                  <span class="block text-xs opacity-60"
                    >Someone at the district office can make this go away. The papers will
                    notice.</span
                  >
                </button>
              `
            : v.settleRejection
              ? html`<div
                  class="rounded bg-white/5 px-3 py-2 text-xs opacity-70"
                  data-testid="card-settle-unavailable"
                >
                  ${v.settleRejection.reason}
                </div>`
              : nothing
        }
        <button
          class="w-full rounded bg-red-700 px-3 py-2 font-medium hover:bg-red-600"
          data-testid="card-dismiss"
          @click=${() => this.handlers.dismiss()}
        >
          Accept the investigation
        </button>
      </div>
    `;
  }

  private arrest(v: CardView) {
    return html`
      <div class="mb-1 text-xs uppercase tracking-widest text-red-400">${formatDate(v.tick)}</div>
      <div class="mb-2 text-2xl font-bold">Under arrest</div>
      <p class="mb-4 text-sm leading-relaxed opacity-85">
        ${v.headline?.body ?? 'The fires were set on purpose, and the letters were ignored.'}
        ${v.letters > 0 ? html` The file holds ${v.letters} notice${v.letters === 1 ? '' : 's'} from the authorities.` : nothing}
      </p>
      <div
        class="mb-5 max-h-56 overflow-y-auto rounded-lg bg-white/5 p-3"
        data-testid="card-timeline"
      >
        <div class="mb-1 text-xs uppercase tracking-wide opacity-60">How it went</div>
        <ol class="space-y-1 text-xs">
          ${v.recent.map((n) => html`<li><span class="tabular-nums opacity-60">${formatDate(n.tick)}</span> — ${n.title}</li>`)}
        </ol>
      </div>
      <button
        class="w-full rounded bg-white/15 px-3 py-2 font-medium hover:bg-white/25"
        data-testid="card-new-estate"
        @click=${() => this.handlers.newEstate()}
      >
        New estate
      </button>
    `;
  }
}
