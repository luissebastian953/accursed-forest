/**
 * The news ticker (§8 panels 3 and 8): the latest three headlines along the
 * bottom, lane-coloured, with a badge for unread warnings. Click to open the
 * full feed.
 */

import { html, nothing, render } from 'lit-html';

import type { NewsItem } from '@sim/types';

export const LANE_TONE: Record<NewsItem['lane'], string> = {
  natural: 'bg-emerald-700/80',
  economic: 'bg-sky-700/80',
  government: 'bg-rose-800/80',
};

export const LANE_LABEL: Record<NewsItem['lane'], string> = {
  natural: 'Natural',
  economic: 'Economic',
  government: 'Government',
};

export interface TickerHandlers {
  open(): void;
}

export class NewsTicker {
  private readonly root: HTMLElement;
  private lastKey = '';

  constructor(
    parent: HTMLElement,
    private readonly handlers: TickerHandlers,
  ) {
    this.root = document.createElement('div');
    this.root.className =
      'pointer-events-none absolute inset-x-0 bottom-0 z-10 flex justify-center p-2';
    parent.appendChild(this.root);
  }

  update(news: readonly NewsItem[], unread: number): void {
    const latest = news.slice(-3).reverse();
    const key = `${news.length}:${latest[0]?.tick ?? -1}:${latest[0]?.title ?? ''}:${unread}`;
    if (key === this.lastKey) return;
    this.lastKey = key;

    render(
      latest.length === 0
        ? nothing
        : html`
            <button
              class="pointer-events-auto flex max-w-[min(64rem,calc(100vw-1rem))] items-center gap-2 overflow-hidden rounded-xl bg-black/65 px-3 py-1.5 text-left text-xs text-white shadow-lg backdrop-blur hover:bg-black/75"
              data-testid="news-ticker"
              @click=${() => this.handlers.open()}
            >
              <span class="shrink-0 font-semibold uppercase tracking-wide opacity-70">News</span>
              ${
                unread > 0
                  ? html`<span
                      class="shrink-0 rounded-full bg-red-600 px-1.5 font-semibold tabular-nums"
                      data-testid="news-unread"
                      >${unread}</span
                    >`
                  : nothing
              }
              ${latest.map(
                (item, i) => html`
                  <span
                    class=${`flex min-w-0 items-center gap-1.5 ${i > 0 ? 'hidden md:flex' : ''}`}
                  >
                    <span class=${`h-2 w-2 shrink-0 rounded-full ${LANE_TONE[item.lane]}`}></span>
                    <span class="truncate" data-testid=${i === 0 ? 'news-ticker-latest' : ''}
                      >${item.title}</span
                    >
                  </span>
                `,
              )}
            </button>
          `,
      this.root,
    );
  }

  dispose(): void {
    this.root.remove();
  }
}
