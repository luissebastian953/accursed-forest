/**
 * The epilogue (§3.8, §8 panel 15): how the run ended, the numbers that tell
 * the truth about it, and the run replayed as a chain of headlines. Losses
 * offer the rewind; the certificate and the fade offer sandbox.
 *
 * Laid out in the cartoon kit: a tinted header band with the ending's badge,
 * the day's headline as a note, the President's word at the door on a win,
 * a grid of number tiles with the telling ones tinted, the chronicle folded
 * away behind "How it went", and the ways forward at the bottom.
 */

import { html, nothing, render, type TemplateResult } from 'lit-html';

import { GROWTH } from '@sim/balance/growth';
import type { ChronicleEntry, Ending, NewsItem, RunStats, YearSummary } from '@sim/types';

import { formatDate, formatPercent, formatRp } from './format.ts';
import { icon, type IconName } from './icons.ts';

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

/** A tile's tint: the numbers that explain the ending get a colour. */
type Tone = 'plain' | 'good' | 'warn' | 'bad';

interface Stat {
  label: string;
  value: string;
  tone?: Tone;
}

interface Look {
  /** The small line above the title. */
  kicker: string;
  title: string;
  line: string;
  icon: IconName;
  /** Header band and badge colours. */
  band: string;
  badge: string;
  title_: string;
  /** What the number grid is called. */
  numbers: string;
}

const LOOK: Record<Ending, Look> = {
  clean: {
    kicker: 'You won · certified',
    title: 'ISPO certified',
    line: 'A model estate — and this time the papers mean it.',
    icon: 'certificate-ispo',
    band: 'linear-gradient(180deg, #fff3cd, #ffe9a8)',
    badge: '#fff9e6',
    title_: '#4a3320',
    numbers: 'The numbers',
  },
  dirty: {
    kicker: 'You won · certified',
    title: 'ISPO certified',
    line: 'Same banner, same ceremony. Someone at the Ministry was persuaded.',
    icon: 'certificate-ispo',
    band: 'linear-gradient(180deg, #fff3cd, #ffe9a8)',
    badge: '#fff9e6',
    title_: '#4a3320',
    numbers: 'The numbers',
  },
  fade: {
    kicker: 'Run over · the horizon',
    title: 'Twenty-five years',
    line: 'Survived every season, never certified. The first palms are too tall to harvest.',
    icon: 'calendar',
    band: 'linear-gradient(180deg, #e3eef8, #cddbe0)',
    badge: '#f4f8fb',
    title_: '#2f56b8',
    numbers: 'The numbers',
  },
  bankrupt: {
    kicker: 'Run over · loss',
    title: 'Bankrupt',
    line: 'The bank stopped waiting.',
    icon: 'coin',
    band: 'linear-gradient(180deg, #ffd9cc, #f9c5b5)',
    badge: '#fff1ec',
    title_: '#9e2e20',
    numbers: 'What went wrong',
  },
  banned: {
    kicker: 'Run over · loss',
    title: 'Shut down',
    line: 'The operating ban outlasted the cash.',
    icon: 'police-warning',
    band: 'linear-gradient(180deg, #ffd9cc, #f9c5b5)',
    badge: '#fff1ec',
    title_: '#9e2e20',
    numbers: 'What went wrong',
  },
  arrested: {
    kicker: 'Run over · loss',
    title: 'Under arrest',
    line: 'The fires were set on purpose, and the letters were ignored.',
    icon: 'police-warning',
    band: 'linear-gradient(180deg, #ffd9cc, #f9c5b5)',
    badge: '#fff1ec',
    title_: '#9e2e20',
    numbers: 'What went wrong',
  },
};

const TONE_CLASS: Record<Tone, string> = {
  plain: 'bg-[var(--pill)] border-transparent',
  good: 'bg-[#e4f6dc] border-[var(--green)] text-[#2f7a2b]',
  warn: 'bg-[#ffe6c8] border-[var(--orange)] text-[#b85e12]',
  bad: 'bg-[#ffdcd6] border-[var(--coral)] text-[#9e2e20]',
};

const LANE_DOT: Record<ChronicleEntry['lane'], string> = {
  natural: 'bg-[var(--green-2)]',
  economic: 'bg-[var(--blue)]',
  government: 'bg-[var(--orange-2)]',
  estate: 'bg-[var(--ink-2)]',
};

export class Epilogue {
  private readonly root: HTMLElement;
  private view: EpilogueView | null = null;
  private timelineOpen = false;

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
    this.timelineOpen = false;
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
    const count = (n: number) => n.toLocaleString('en');
    const profit = (value: number): Stat => ({
      label: 'Operating profit',
      value: formatRp(value),
      tone: value >= 0 ? 'good' : 'bad',
    });
    switch (v.ending) {
      case 'clean':
        return [
          { label: 'Years', value: String(years) },
          { label: 'Forest cover', value: formatPercent(v.forestCover), tone: 'good' },
          { label: 'Forest planted back', value: `${s.forestPlanted} ha` },
          { label: 'Disasters weathered', value: String(s.disasters) },
          { label: 'Palms lost', value: count(s.palmsLost) },
          profit(v.profitTotal),
        ];
      case 'dirty':
        return [
          { label: 'Years', value: String(years) },
          {
            label: 'Hectares burned',
            value: String(s.blocksBurned),
            tone: s.blocksBurned > 0 ? 'warn' : 'plain',
          },
          {
            label: "Neighbours' land burned",
            value: `${s.neighbourBlocksBurned} ha`,
            tone: s.neighbourBlocksBurned > 0 ? 'warn' : 'plain',
          },
          { label: 'Forest chopped', value: `${s.forestChopped} ha` },
          {
            label: 'Fines never paid',
            value: s.settled > 0 ? formatRp(s.settled) : '—',
            tone: s.settled > 0 ? 'warn' : 'plain',
          },
          profit(v.profitTotal),
        ];
      case 'fade':
        return [
          { label: 'Hectares bearing', value: String(v.matureHectares) },
          profit(v.profitTotal),
          { label: 'Last three years', value: formatRp(lastThree) },
          { label: 'Forest cover', value: formatPercent(v.forestCover) },
          { label: 'Disasters weathered', value: String(s.disasters) },
          { label: 'Palms lost', value: count(s.palmsLost) },
        ];
      case 'bankrupt':
      case 'banned':
        return [
          { label: 'Years', value: String(years) },
          { label: 'Debt', value: formatRp(Math.min(0, v.cash)), tone: 'bad' },
          { label: 'Days below credit line', value: String(v.insolventFor), tone: 'bad' },
          { label: 'Hectares bearing', value: String(v.matureHectares) },
          { label: 'Disasters weathered', value: String(s.disasters) },
          { label: 'Palms lost', value: count(s.palmsLost) },
        ];
      case 'arrested':
        return [
          { label: 'Notices from the authorities', value: String(v.letters), tone: 'bad' },
          { label: 'Burns lit', value: String(s.burns), tone: 'bad' },
          {
            label: 'Hectares burned',
            value: String(s.blocksBurned),
            tone: s.blocksBurned > 0 ? 'warn' : 'plain',
          },
          { label: "Neighbours' land burned", value: `${s.neighbourBlocksBurned} ha` },
          { label: 'Forest chopped', value: `${s.forestChopped} ha` },
          {
            label: 'Coordination fees',
            value: s.settled > 0 ? formatRp(s.settled) : '—',
            tone: s.settled > 0 ? 'warn' : 'plain',
          },
        ];
    }
  }

  /** A note card: an icon tile and a line of text. */
  private note(
    iconName: IconName,
    body: TemplateResult,
    extra = 'bg-[var(--pill)] border-[var(--card-edge)]',
    testId?: string,
  ): TemplateResult {
    return html`
      <div
        class=${`flex items-start gap-3 rounded-2xl border-2 px-4 py-3 ${extra}`}
        data-testid=${testId ?? nothing}
      >
        <span
          class="flex h-9 w-9 flex-none items-center justify-center rounded-xl border-2 border-[var(--coral)] bg-[#fff1ec] shadow-[0_2px_0_var(--coral-edge)]"
        >
          ${icon(iconName)}
        </span>
        <div class="min-w-0 text-sm leading-relaxed">${body}</div>
      </div>
    `;
  }

  private render(): void {
    const v = this.view;
    if (!v) {
      render(nothing, this.root);
      return;
    }
    const look = LOOK[v.ending];
    const win = v.ending === 'clean' || v.ending === 'dirty';
    const sandbox = win || v.ending === 'fade';
    const rewind = !win && v.rewindYears.length > 0;
    const years = Math.max(1, Math.ceil(v.endedAt / GROWTH.daysPerYear));
    const oldest = Math.min(...v.rewindYears);

    render(
      html`
        <div
          class="absolute inset-0 z-40 flex items-center justify-center bg-[rgba(30,20,12,0.6)] p-4"
        >
          <div
            class="card flex max-h-full w-full max-w-2xl flex-col overflow-hidden"
            data-testid="epilogue"
            data-ending=${v.ending}
          >
            <!-- Header band -->
            <div
              class="flex items-start gap-4 border-b-2 border-[var(--card-edge)] px-5 pb-4 pt-5"
              style=${`background:${look.band}`}
            >
              <span
                class="flex h-16 w-16 flex-none items-center justify-center rounded-2xl border-2 border-[var(--ink)]/70 shadow-[0_4px_0_rgba(74,51,32,0.45)]"
                style=${`background:${look.badge}`}
              >
                ${icon(look.icon, 'icon-lg !h-9 !w-9')}
              </span>
              <div class="min-w-0 flex-1">
                <div class="flex flex-wrap items-center gap-2">
                  <span class="label !text-[var(--ink)] opacity-70">${look.kicker}</span>
                  <span class="pill label !py-0.5 !text-[var(--ink)]">
                    Estate ${v.estateCode} · ${formatDate(v.endedAt)}
                  </span>
                </div>
                <div
                  class="mt-0.5 text-4xl font-extrabold leading-tight"
                  style=${`color:${look.title_}`}
                  data-testid="epilogue-title"
                >
                  ${look.title}
                </div>
                <p class="mt-1 text-sm font-bold opacity-80">${look.line}</p>
              </div>
            </div>

            <div class="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-5 py-4">
              ${
                v.headline
                  ? this.note('news', html`<b>“${v.headline.title}”</b> — ${v.headline.body}`)
                  : nothing
              }
              ${
                win
                  ? this.note(
                      'certificate-ispo',
                      html`
                        <div class="label !text-[#9e2e20]">The President, at the Kopdes door</div>
                        <div class="mt-0.5 text-base font-extrabold text-[#9e2e20]">
                          “Your palm trees will do the country a favour.”
                        </div>
                      `,
                      'bg-[#ffe6e0] border-[var(--coral)]',
                      'epilogue-president',
                    )
                  : nothing
              }

              <div>
                <div class="label mb-2">${look.numbers}</div>
                <div class="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  ${this.stats(v).map(
                    (stat) => html`
                      <div
                        class=${`rounded-2xl border-2 px-4 py-3 ${TONE_CLASS[stat.tone ?? 'plain']}`}
                        data-testid="epilogue-stat"
                      >
                        <div class="label !text-current opacity-70">${stat.label}</div>
                        <div class="num mt-0.5 text-xl font-extrabold leading-tight">
                          ${stat.value}
                        </div>
                      </div>
                    `,
                  )}
                </div>
              </div>

              <div
                class="rounded-2xl border-2 border-[var(--card-edge)] bg-[var(--pill)] shadow-[0_3px_0_var(--card-shadow)]"
                data-testid="epilogue-timeline"
              >
                <button
                  class="flex w-full items-center gap-2 px-4 py-2.5 text-left"
                  data-testid="epilogue-timeline-toggle"
                  aria-expanded=${this.timelineOpen}
                  @click=${() => {
                    this.timelineOpen = !this.timelineOpen;
                    this.render();
                  }}
                >
                  <span class="text-sm font-extrabold">How it went</span>
                  <span class="pill-muted label !py-0.5">
                    ${v.chronicle.length} events · ${years} ${years === 1 ? 'year' : 'years'}
                  </span>
                  <span class="ml-auto text-sm font-extrabold opacity-70">
                    ${this.timelineOpen ? 'Hide ▴' : 'Show ▾'}
                  </span>
                </button>
                ${
                  this.timelineOpen
                    ? html`
                        <ol
                          class="max-h-56 space-y-1 overflow-y-auto border-t-2 border-[var(--card-edge)] px-4 py-3 text-xs"
                        >
                          ${v.chronicle.map(
                            (entry) => html`
                              <li class="flex items-baseline gap-2">
                                <span
                                  class=${`inline-block h-2 w-2 shrink-0 rounded-full ${LANE_DOT[entry.lane]}`}
                                ></span>
                                <span class="w-28 shrink-0 tabular-nums opacity-60"
                                  >${formatDate(entry.tick)}</span
                                >
                                <span
                                  class=${
                                    entry.severity === 'critical'
                                      ? 'font-extrabold'
                                      : 'font-bold opacity-85'
                                  }
                                  >${entry.title}</span
                                >
                              </li>
                            `,
                          )}
                        </ol>
                      `
                    : nothing
                }
              </div>

              ${
                rewind
                  ? html`
                      <div
                        class="rounded-2xl border-2 border-[var(--blue)] bg-[#dbe7ff] px-4 py-3 text-[#2f56b8]"
                      >
                        <div class="flex items-center gap-2 text-base font-extrabold">
                          <span aria-hidden="true">↺</span> Try again from an earlier year
                        </div>
                        <div class="text-xs font-bold opacity-80">
                          Same seed, same weather ahead — different decisions.
                        </div>
                        <div class="mt-2 flex flex-wrap gap-2">
                          ${v.rewindYears
                            .slice(0, 6)
                            .map(
                              (year) => html`
                                <button
                                  class="btn btn-sm btn-blue"
                                  data-testid=${`epilogue-rewind-${year}`}
                                  @click=${() => this.handlers.rewind(year)}
                                >
                                  Year ${year}${year === oldest && year === 1 ? ' · start' : ''}
                                </button>
                              `,
                            )}
                        </div>
                      </div>
                    `
                  : nothing
              }
            </div>

            <!-- Ways forward -->
            <div class="flex flex-wrap gap-2 border-t-2 border-[var(--card-edge)] px-5 py-4">
              ${
                sandbox
                  ? html`<button
                      class="btn btn-green btn-lg flex-1 flex-col !gap-0 !py-2 leading-tight"
                      data-testid="epilogue-keep-playing"
                      @click=${() => this.handlers.keepPlaying()}
                    >
                      <span class="uppercase tracking-wide">▸ Keep playing</span>
                      <span class="text-[0.68rem] font-bold opacity-85"
                        >sandbox · no more endings</span
                      >
                    </button>`
                  : nothing
              }
              <button
                class=${`btn btn-lg flex-1 uppercase tracking-wide ${sandbox ? 'btn-ghost' : 'btn-coral'}`}
                data-testid="epilogue-new-estate"
                @click=${() => this.handlers.newEstate()}
              >
                New estate
              </button>
            </div>
          </div>
        </div>
      `,
      this.root,
    );
  }
}
