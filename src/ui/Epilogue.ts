/**
 * The epilogue (§3.8, §8 panel 15): how the run ended, the numbers that tell
 * the truth about it, and the run replayed as a chain of headlines. Losses
 * offer the rewind; the certificate and the fade offer sandbox.
 */

import { html, nothing, render } from 'lit-html';

import { GROWTH } from '@sim/balance/growth';
import type { ChronicleEntry, Ending, NewsItem, RunStats, YearSummary } from '@sim/types';

import { formatDate, formatPercent, formatRp } from './format.ts';

export interface EpilogueView {
  ending: Ending;
  endedAt: number;
  estateCode: string;
  headline: NewsItem | null;
  stats: RunStats;
  cash: number;
  profitTotal: number;
  years: readonly YearSummary[];
  forestCover: number;
  matureHectares: number;
  letters: number;
  insolventFor: number;
  chronicle: readonly ChronicleEntry[];
  /** Years with a start-of-year snapshot, newest first. */
  rewindYears: readonly number[];
}

export interface EpilogueHandlers {
  rewind(year: number): void;
  keepPlaying(): void;
  newEstate(): void;
}

interface Stat {
  label: string;
  value: string;
}

const TITLE: Record<Ending, { title: string; line: string; tone: string }> = {
  clean: {
    title: 'ISPO certified',
    line: 'A model estate — and this time the papers mean it.',
    tone: 'text-emerald-300',
  },
  dirty: {
    title: 'ISPO certified',
    line: 'Same banner, same ceremony. Someone at the Ministry was persuaded.',
    tone: 'text-amber-300',
  },
  fade: {
    title: 'Twenty-five years',
    line: 'Survived every season, never certified. The first palms are too tall to harvest.',
    tone: 'text-sky-200',
  },
  bankrupt: {
    title: 'Bankrupt',
    line: 'The bank stopped waiting.',
    tone: 'text-red-300',
  },
  banned: {
    title: 'Shut down',
    line: 'The operating ban outlasted the cash.',
    tone: 'text-red-300',
  },
  arrested: {
    title: 'Under arrest',
    line: 'The fires were set on purpose, and the letters were ignored.',
    tone: 'text-red-400',
  },
};

const LANE_DOT: Record<ChronicleEntry['lane'], string> = {
  natural: 'bg-emerald-400',
  economic: 'bg-sky-400',
  government: 'bg-amber-400',
  estate: 'bg-white',
};

export class Epilogue {
  private readonly root: HTMLElement;
  private view: EpilogueView | null = null;

  constructor(
    parent: HTMLElement,
    private readonly handlers: EpilogueHandlers,
  ) {
    this.root = document.createElement('div');
    parent.appendChild(this.root);
  }

  get isOpen(): boolean {
    return this.view !== null;
  }

  show(view: EpilogueView): void {
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

  private stats(v: EpilogueView): Stat[] {
    const s = v.stats;
    const years = Math.max(1, Math.ceil(v.endedAt / GROWTH.daysPerYear));
    const lastThree = v.years.slice(-3).reduce((sum, y) => sum + y.profit, 0);
    switch (v.ending) {
      case 'clean':
        return [
          { label: 'Years', value: String(years) },
          { label: 'Forest cover', value: formatPercent(v.forestCover) },
          { label: 'Forest planted back', value: `${s.forestPlanted} ha` },
          { label: 'Disasters weathered', value: String(s.disasters) },
          { label: 'Palms lost', value: s.palmsLost.toLocaleString('en') },
          { label: 'Operating profit', value: formatRp(v.profitTotal) },
        ];
      case 'dirty':
        return [
          { label: 'Years', value: String(years) },
          { label: 'Hectares burned', value: String(s.blocksBurned) },
          { label: "Neighbours' land burned", value: `${s.neighbourBlocksBurned} ha` },
          { label: 'Forest chopped', value: `${s.forestChopped} ha` },
          { label: 'Fines never paid', value: s.settled > 0 ? formatRp(s.settled) : '—' },
          { label: 'Operating profit', value: formatRp(v.profitTotal) },
        ];
      case 'fade':
        return [
          { label: 'Hectares bearing', value: String(v.matureHectares) },
          { label: 'Operating profit', value: formatRp(v.profitTotal) },
          { label: 'Last three years', value: formatRp(lastThree) },
          { label: 'Forest cover', value: formatPercent(v.forestCover) },
          { label: 'Disasters weathered', value: String(s.disasters) },
          { label: 'Palms lost', value: s.palmsLost.toLocaleString('en') },
        ];
      case 'bankrupt':
      case 'banned':
        return [
          { label: 'Years', value: String(years) },
          { label: 'Debt', value: formatRp(Math.min(0, v.cash)) },
          { label: 'Days below the credit line', value: String(v.insolventFor) },
          { label: 'Hectares bearing', value: String(v.matureHectares) },
          { label: 'Disasters weathered', value: String(s.disasters) },
          { label: 'Palms lost', value: s.palmsLost.toLocaleString('en') },
        ];
      case 'arrested':
        return [
          { label: 'Notices from the authorities', value: String(v.letters) },
          { label: 'Burns lit', value: String(s.burns) },
          { label: 'Hectares burned', value: String(s.blocksBurned) },
          { label: "Neighbours' land burned", value: `${s.neighbourBlocksBurned} ha` },
          { label: 'Forest chopped', value: `${s.forestChopped} ha` },
          { label: 'Coordination fees', value: s.settled > 0 ? formatRp(s.settled) : '—' },
        ];
    }
  }

  private render(): void {
    const v = this.view;
    if (!v) {
      render(nothing, this.root);
      return;
    }
    const t = TITLE[v.ending];
    const win = v.ending === 'clean' || v.ending === 'dirty';
    const sandbox = win || v.ending === 'fade';
    const rewind = v.ending !== 'clean' && v.ending !== 'dirty';

    render(
      html`
        <div
          class="absolute inset-0 z-40 flex items-center justify-center bg-[rgba(30,20,12,0.6)] p-4"
        >
          <div
            class="card-dark flex max-h-full w-full max-w-2xl flex-col overflow-hidden"
            data-testid="epilogue"
            data-ending=${v.ending}
          >
            <div class="border-b border-white/10 px-6 pb-4 pt-5">
              <div class="mb-1 text-xs font-extrabold uppercase tracking-widest opacity-60">
                Estate ${v.estateCode} · ${formatDate(v.endedAt)}
              </div>
              <div class=${`text-3xl font-extrabold ${t.tone}`} data-testid="epilogue-title">
                ${t.title}
              </div>
              <p class="mt-1 text-sm opacity-85">${t.line}</p>
              ${
                v.headline
                  ? html`<p class="mt-3 text-sm italic leading-relaxed opacity-75">
                      “${v.headline.title}” — ${v.headline.body}
                    </p>`
                  : nothing
              }
            </div>

            <div class="grid grid-cols-2 gap-x-6 gap-y-2 px-6 py-4 text-sm sm:grid-cols-3">
              ${this.stats(v).map(
                (stat) => html`
                  <div data-testid="epilogue-stat">
                    <div class="text-xs uppercase tracking-wide opacity-55">${stat.label}</div>
                    <div class="num text-lg">${stat.value}</div>
                  </div>
                `,
              )}
            </div>

            <div class="min-h-0 flex-1 overflow-y-auto px-6 pb-3" data-testid="epilogue-timeline">
              <div class="mb-1 text-xs font-extrabold uppercase tracking-wide opacity-60">
                How it went
              </div>
              <ol class="space-y-1 text-xs">
                ${v.chronicle.map(
                  (entry) => html`
                    <li class="flex items-baseline gap-2">
                      <span
                        class=${`inline-block h-1.5 w-1.5 shrink-0 rounded-full ${LANE_DOT[entry.lane]}`}
                      ></span>
                      <span class="w-28 shrink-0 tabular-nums opacity-55"
                        >${formatDate(entry.tick)}</span
                      >
                      <span class=${entry.severity === 'critical' ? 'font-semibold' : 'opacity-90'}
                        >${entry.title}</span
                      >
                    </li>
                  `,
                )}
              </ol>
            </div>

            <div class="flex flex-col gap-2 border-t border-white/10 px-6 py-4">
              ${
                rewind && v.rewindYears.length > 0
                  ? html`
                      <div class="text-xs opacity-60">
                        Same seed, same weather ahead — different decisions.
                      </div>
                      <div class="flex flex-wrap gap-2">
                        ${v.rewindYears
                          .slice(0, 6)
                          .map(
                            (year) => html`
                              <button
                                class="btn btn-sm btn-blue"
                                data-testid=${`epilogue-rewind-${year}`}
                                @click=${() => this.handlers.rewind(year)}
                              >
                                Return to Year ${year}
                              </button>
                            `,
                          )}
                      </div>
                    `
                  : nothing
              }
              <div class="flex flex-wrap gap-2">
                ${
                  sandbox
                    ? html`<button
                        class="btn btn-green btn-lg flex-1"
                        data-testid="epilogue-keep-playing"
                        @click=${() => this.handlers.keepPlaying()}
                      >
                        Keep playing
                      </button>`
                    : nothing
                }
                <button
                  class="btn btn-lg flex-1 bg-white/15 shadow-[0_3px_0_rgba(0,0,0,0.35)]"
                  data-testid="epilogue-new-estate"
                  @click=${() => this.handlers.newEstate()}
                >
                  New estate
                </button>
              </div>
            </div>
          </div>
        </div>
      `,
      this.root,
    );
  }
}
