/**
 * The authorities' paperwork (§8 panel 17b): the letter, the investigation
 * notice with its "settle the matter" option when integrity allows, and the
 * operating ban (§3.8). The arrest is an ending; the epilogue tells it.
 */

import { html, nothing, render } from 'lit-html';

import type { NewsItem, Rejection } from '@sim/types';

import { formatDate, formatRp } from './format.ts';

export type CardKind = 'letter' | 'investigation' | 'ban';

export interface CardView {
  kind: CardKind;
  tick: number;
  headline: NewsItem | null;
  /** Investigation and operating ban: when it lifts. */
  until: number | null;
  settleCost: number | null;
  settleRejection: Rejection | null;
}

export interface CardHandlers {
  dismiss(): void;
  settle(): void;
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
            class=${`w-full max-w-lg rounded-2xl p-6 text-white shadow-2xl ${v.kind === 'ban' ? 'bg-neutral-950' : 'bg-stone-900'}`}
            data-testid=${`card-${v.kind}`}
          >
            ${v.kind === 'letter' ? this.letter(v) : v.kind === 'investigation' ? this.investigation(v) : this.ban(v)}
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

  private ban(v: CardView) {
    return html`
      <div class="mb-1 text-xs uppercase tracking-widest text-red-300">
        Ministry enforcement team · ${formatDate(v.tick)}
      </div>
      <div class="mb-3 text-lg font-semibold">
        ${v.headline?.title ?? 'Operating licence suspended'}
      </div>
      <p class="mb-3 text-sm leading-relaxed opacity-85">${v.headline?.body ?? ''}</p>
      <ul class="mb-4 space-y-1 text-sm">
        <li>
          🚫 No clearing, palm planting or harvest until
          <strong>${v.until !== null ? formatDate(v.until) : '—'}</strong>.
        </li>
        <li>🌱 Planting forest back is allowed.</li>
        <li>💸 Upkeep runs at half, and the bank will not lend against a shut estate.</li>
      </ul>
      <button
        class="w-full rounded bg-red-700 px-3 py-2 font-medium hover:bg-red-600"
        data-testid="card-dismiss"
        @click=${() => this.handlers.dismiss()}
      >
        Understood
      </button>
    `;
  }
}
