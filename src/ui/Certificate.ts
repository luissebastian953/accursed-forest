/**
 * ISPO progress (§8 panels 18–19): the year-end card each New Year, and the
 * five-condition checklist reachable from the top bar from Year 3, so the win
 * is legible before it happens.
 */

import { html, nothing, render } from 'lit-html';

import type { IspoCondition, IspoConditionId } from '@sim/systems/endings';
import type { YearSummary } from '@sim/types';

import { formatPercent, formatRp } from './format.ts';
import { icon } from './icons.ts';

const CONDITION_LABEL: Record<IspoConditionId, string> = {
  profit: 'Operating profit, and three profitable years',
  hectares: 'Hectares bearing fruit',
  noBurn: 'No burn-to-clear',
  forest: 'Forest on the slopes',
  kopdes: 'Kopdes at its highest level',
};

function conditionValue(c: IspoCondition): string {
  switch (c.id) {
    case 'profit':
      return `${formatRp(c.value)} of ${formatRp(c.target)}`;
    case 'hectares':
      return `${c.value} of ${c.target} ha`;
    case 'noBurn':
      return c.met ? `${c.target}+ years clean` : `${c.value.toFixed(1)} of ${c.target} years`;
    case 'forest':
      return `${formatPercent(c.value)} of ${formatPercent(c.target)}`;
    case 'kopdes':
      return `level ${c.value} of ${c.target}`;
  }
}

function checklist(conditions: readonly IspoCondition[]) {
  return html`
    <ul class="space-y-1.5 text-sm">
      ${conditions.map(
        (c) => html`
          <li class="flex items-start gap-2" data-testid=${`certificate-condition-${c.id}`}>
            <span class=${c.met ? 'font-extrabold text-[#3faa4c]' : 'muted'}
              >${c.met ? '✓' : '○'}</span
            >
            <span class="flex-1">
              <span class="font-bold">${CONDITION_LABEL[c.id]}</span>
              <span class="muted num block text-xs">${conditionValue(c)}</span>
            </span>
          </li>
        `,
      )}
    </ul>
  `;
}

export interface CertificateHandlers {
  close(): void;
}

/** The checklist popover under the top bar. */
export class CertificatePanel {
  private readonly root: HTMLElement;
  private conditions: readonly IspoCondition[] | null = null;

  constructor(
    parent: HTMLElement,
    private readonly handlers: CertificateHandlers,
  ) {
    this.root = document.createElement('div');
    parent.appendChild(this.root);
  }

  get isOpen(): boolean {
    return this.conditions !== null;
  }

  show(conditions: readonly IspoCondition[]): void {
    this.conditions = conditions;
    this.render();
  }

  hide(): void {
    this.conditions = null;
    this.render();
  }

  dispose(): void {
    this.root.remove();
  }

  private render(): void {
    const conditions = this.conditions;
    if (!conditions) {
      render(nothing, this.root);
      return;
    }
    const met = conditions.filter((c) => c.met).length;
    render(
      html`
        <div
          class="card absolute left-1/2 top-28 z-30 w-[min(24rem,calc(100%-2rem))] -translate-x-1/2 p-4"
          data-testid="certificate-panel"
        >
          <div class="mb-1 flex items-center justify-between">
            <div class="flex items-center gap-2 font-extrabold">
              ${icon('certificate-ispo')} ISPO certificate ·
              <span class="num">${met}/${conditions.length}</span>
            </div>
            <button
              class="btn btn-close"
              data-testid="certificate-close"
              @click=${() => this.handlers.close()}
            >
              ✕
            </button>
          </div>
          <p class="muted mb-3 text-xs">
            Checked at the close of every year. Meet all five and the Ministry sends a banner.
          </p>
          ${checklist(conditions)}
        </div>
      `,
      this.root,
    );
  }
}

export interface YearEndView {
  summary: YearSummary;
  previous: YearSummary | null;
  /** Null before the checklist is shown (§8 panel 19: from Year 3). */
  conditionsMet: number | null;
}

/** The New Year card: not modal, and it gets out of the way on its own. */
export class YearEndCard {
  private readonly root: HTMLElement;
  private view: YearEndView | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor(parent: HTMLElement) {
    this.root = document.createElement('div');
    parent.appendChild(this.root);
  }

  get isOpen(): boolean {
    return this.view !== null;
  }

  show(view: YearEndView, holdMs = 12_000): void {
    this.view = view;
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = setTimeout(() => this.hide(), holdMs);
    this.render();
  }

  hide(): void {
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;
    this.view = null;
    this.render();
  }

  dispose(): void {
    this.hide();
    this.root.remove();
  }

  private render(): void {
    const v = this.view;
    if (!v) {
      render(nothing, this.root);
      return;
    }
    const s = v.summary;
    const coverDelta = v.previous ? s.forestCover - v.previous.forestCover : null;
    render(
      html`
        <div class="card absolute right-3 top-28 z-20 w-64 p-4 text-sm" data-testid="year-end-card">
          <div class="mb-2 flex items-center justify-between">
            <div class="font-extrabold">Year ${s.year} closed</div>
            <button
              class="btn btn-close"
              data-testid="year-end-dismiss"
              @click=${() => this.hide()}
            >
              ✕
            </button>
          </div>
          <dl class="grid grid-cols-2 gap-y-1">
            <dt class="label">${s.profit >= 0 ? 'Profit' : 'Loss'}</dt>
            <dd
              class=${`text-right tabular-nums ${s.profit >= 0 ? 'text-emerald-300' : 'text-red-300'}`}
            >
              ${formatRp(Math.abs(s.profit))}
            </dd>
            <dt class="label">Bearing</dt>
            <dd class="num text-right">${s.matureHectares} ha</dd>
            <dt class="label">Forest cover</dt>
            <dd class="num text-right">
              ${formatPercent(s.forestCover)}${
                coverDelta !== null && Math.abs(coverDelta) >= 0.005
                  ? html` <span class=${coverDelta > 0 ? 'text-[#3faa4c]' : 'text-[#b85e12]'}
                      >${coverDelta > 0 ? '+' : '−'}${formatPercent(Math.abs(coverDelta))}</span
                    >`
                  : nothing
              }
            </dd>
            ${
              v.conditionsMet !== null
                ? html`<dt class="label">ISPO</dt>
                    <dd class="num text-right">${v.conditionsMet}/5</dd>`
                : nothing
            }
          </dl>
        </div>
      `,
      this.root,
    );
  }
}
