/**
 * The news panel (§8 panel 13): the full feed, newest first, with lane
 * filters and a "what this does to you" line per item. Clicking an item with
 * blocks focuses the map on them.
 *
 * Drawn as a cartoon smartphone (design kit, phone-frame asset): the frame
 * body sits under the screen, the notch and home bar over it, and the feed
 * scrolls inside the screen's safe zone. Opening shows how many warnings are
 * new; "Mark all as read" and closing both clear them.
 */

import { html, nothing, render } from 'lit-html';

import type { BlockId, NewsItem } from '@sim/types';

import { formatDate } from './format.ts';
import { icon } from './icons.ts';
import { LANE_LABEL, LANE_TONE } from './newsLane.ts';
import { phoneHeader, phoneShell } from './phone.ts';

export interface NewsPanelHandlers {
  focus(block: BlockId): void;
  close(): void;
  markRead(): void;
}

/** What the phone's status bar and badge show. */
export interface NewsStatus {
  tick: number;
  unread: number;
}

type Filter = NewsItem['lane'] | 'all';

const FILTER_LABEL: Record<Filter, string> = {
  all: 'All',
  natural: 'Natural',
  economic: 'Economic',
  government: "Gov't",
};

export class NewsPanel {
  private readonly root: HTMLElement;
  private open = false;
  private filter: Filter = 'all';
  private news: readonly NewsItem[] = [];
  private status: NewsStatus = { tick: 0, unread: 0 };

  constructor(
    parent: HTMLElement,
    private readonly handlers: NewsPanelHandlers,
  ) {
    this.root = document.createElement('div');
    parent.appendChild(this.root);
  }

  get isOpen(): boolean {
    return this.open;
  }

  show(news: readonly NewsItem[], status: NewsStatus): void {
    this.open = true;
    this.news = news;
    this.status = status;
    this.render();
  }

  hide(): void {
    this.open = false;
    this.render();
  }

  /** Re-render if open and the feed grew or the badge changed. */
  update(news: readonly NewsItem[], status: NewsStatus): void {
    if (!this.open) return;
    const same =
      news.length === this.news.length &&
      news.at(-1) === this.news.at(-1) &&
      status.unread === this.status.unread &&
      status.tick === this.status.tick;
    if (same) return;
    this.news = news;
    this.status = status;
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
    const items = [...this.news]
      .reverse()
      .filter((n) => this.filter === 'all' || n.lane === this.filter);
    const filters: Filter[] = ['all', 'natural', 'economic', 'government'];

    render(
      phoneShell({
        testId: 'news-panel',
        tick: this.status.tick,
        header: html`
          ${phoneHeader({
            tile: icon('news', 'icon-lg'),
            title: 'News',
            extra:
              this.status.unread > 0
                ? html`<span
                    class="chip chip-pest num !py-0.5 text-xs"
                    data-testid="news-unread-badge"
                    >${this.status.unread} new</span
                  >`
                : undefined,
            closeTestId: 'news-close',
            onClose: () => this.handlers.close(),
          })}
          <div
            class="grid grid-cols-4 gap-1.5 border-b-2 border-[var(--card-edge)] px-[6%] pb-3 text-xs"
          >
            ${filters.map(
              (f) => html`
                <button
                  class=${`btn btn-sm !px-1 ${this.filter === f ? 'btn-green' : 'btn-ghost'}`}
                  data-testid=${`news-filter-${f}`}
                  @click=${() => {
                    this.filter = f;
                    this.render();
                  }}
                >
                  ${FILTER_LABEL[f]}
                </button>
              `,
            )}
          </div>
        `,
        body: html`
          <ol data-testid="news-list">
            ${
              items.length === 0
                ? html`<li class="muted p-3 text-xs">Nothing in the news yet.</li>`
                : items.map(
                    (item) => html`
                      <li
                        class=${`mb-2 rounded-2xl border-2 border-[var(--card-edge)] bg-[var(--pill-muted)] p-3 ${item.blocks?.length ? 'cursor-pointer hover:brightness-[1.03]' : ''}`}
                        data-testid="news-item"
                        @click=${() => {
                          const first = item.blocks?.[0];
                          if (first !== undefined) this.handlers.focus(first);
                        }}
                      >
                        <div class="mb-1 flex flex-wrap items-center gap-2 text-[11px]">
                          <span
                            class=${`rounded-full px-2 py-px font-extrabold text-white ${LANE_TONE[item.lane]}`}
                            >${LANE_LABEL[item.lane]}</span
                          >
                          <span class="num muted font-bold">${formatDate(item.tick)}</span>
                          ${
                            item.severity === 'critical' || item.severity === 'warning'
                              ? html`<span
                                  class=${`rounded-full px-2 py-px font-extrabold ${item.severity === 'critical' ? 'bg-[#ffd9d4] text-[#9e2e20]' : 'bg-[#ffe6c8] text-[#b85e12]'}`}
                                  >⚠ ${item.severity}</span
                                >`
                              : nothing
                          }
                        </div>
                        <div class="text-base font-extrabold leading-snug">${item.title}</div>
                        <div class="muted mt-1 text-xs leading-snug">${item.body}</div>
                        ${
                          item.effects.length > 0
                            ? html`<div
                                class="mt-2 rounded-xl bg-[var(--card)] px-3 py-1.5 text-xs font-extrabold text-[#b85e12]"
                              >
                                → ${item.effects.join(', ')}
                              </div>`
                            : nothing
                        }
                      </li>
                    `,
                  )
            }
          </ol>
        `,
        footer: html`
          <button
            class="btn btn-ghost w-full"
            data-testid="news-mark-read"
            @click=${() => this.handlers.markRead()}
          >
            Mark all as read
          </button>
        `,
      }),
      this.root,
    );
  }
}
