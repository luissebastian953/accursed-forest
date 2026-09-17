/**
 * The news ticker (§8 panels 3 and 8): the latest three headlines along the
 * bottom, lane-coloured, with a badge for unread warnings. Click to open the
 * full feed.
 */

import { html, nothing, render } from 'lit-html';

import type { NewsItem } from '@sim/types';

import { icon } from './icons.ts';

export const LANE_TONE: Record<NewsItem['lane'], string> = {
  natural: 'bg-[#3faa4c]',
  economic: 'bg-[#5a8bff]',
  government: 'bg-[#e04a3a]',
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
      'ui-slide chrome-right pointer-events-none absolute bottom-0 left-0 z-10 flex justify-center px-[30px] py-2';
    parent.appendChild(this.root);
  }

  /** Slide the ticker down out of the way (the title screens) and back. */
  setHidden(hidden: boolean): void {
    this.root.classList.toggle('ui-hidden-bottom', hidden);
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
              class="card pointer-events-auto flex w-full items-center gap-2.5 overflow-hidden px-3 py-1.5 text-left text-xs hover:brightness-[1.03]"
              data-testid="news-ticker"
              @click=${() => this.handlers.open()}
            >
              <span class="chip chip-cream shrink-0">${icon('news')} NEWS</span>
              ${
                unread > 0
                  ? html`<span class="chip chip-pest num shrink-0" data-testid="news-unread"
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
