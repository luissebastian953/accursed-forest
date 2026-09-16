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
import { LANE_LABEL, LANE_TONE } from './NewsTicker.ts';

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

/** The frame is 480×920; the screen is the 400×840 rounded rect at (40, 40). */
const FRAME_URL = `${import.meta.env.BASE_URL}ui/phone-frame.svg`;
const FRAME_TOP_URL = `${import.meta.env.BASE_URL}ui/phone-frame-top.svg`;

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
    const date = formatDate(this.status.tick).replace('Year ', 'Y').replace(' · Day ', ' · D');

    render(
      html`
        <div
          class="@container absolute bottom-16 left-3 top-[15.25rem] z-20 aspect-[480/920] max-h-[920px] max-w-[calc(100vw-1.5rem)]"
          data-testid="news-panel"
        >
          <img class="absolute inset-0 h-full w-full select-none" src=${FRAME_URL} alt="" />

          <div
            class="absolute bottom-[4.35%] left-[8.33%] right-[8.33%] top-[4.35%] flex flex-col overflow-hidden rounded-[8.75cqw] text-sm"
          >
            <!-- Status bar, either side of the notch -->
            <div
              class="flex items-center justify-between px-[6%] pb-1 pt-[2.2%] text-[0.7rem] font-extrabold text-[#8f7a52]"
            >
              <span class="num">${date}</span>
              <span class="flex items-center gap-1.5" aria-hidden="true">
                <span class="flex items-end gap-px">
                  <i class="block h-1.5 w-1 rounded-sm bg-[#8f7a52]"></i>
                  <i class="block h-2.5 w-1 rounded-sm bg-[#8f7a52]"></i>
                  <i class="block h-3.5 w-1 rounded-sm bg-[#8f7a52]"></i>
                </span>
                <span
                  class="relative ml-1 block h-3 w-6 rounded-[4px] border-2 border-[#8f7a52] after:absolute after:-right-[5px] after:top-[2px] after:h-1 after:w-[3px] after:rounded-r-sm after:bg-[#8f7a52]"
                >
                  <i
                    class="absolute inset-[2px] right-[3px] block rounded-[2px] bg-[var(--green)]"
                  ></i>
                </span>
              </span>
            </div>

            <!-- Header -->
            <div class="flex items-center gap-3 px-[6%] pb-2 pt-1">
              <span
                class="flex h-11 w-11 flex-none items-center justify-center rounded-2xl border-2 border-[var(--coral-edge)] bg-[var(--coral)] shadow-[0_3px_0_var(--coral-edge)]"
              >
                ${icon('news', 'icon-lg')}
              </span>
              <span class="text-2xl font-extrabold leading-none">News</span>
              ${
                this.status.unread > 0
                  ? html`<span
                      class="chip chip-pest num !py-0.5 text-xs"
                      data-testid="news-unread-badge"
                      >${this.status.unread} new</span
                    >`
                  : nothing
              }
              <button
                class="btn btn-close ml-auto !h-11 !w-11 !rounded-2xl !text-lg"
                aria-label="Close"
                data-testid="news-close"
                @click=${() => this.handlers.close()}
              >
                ✕
              </button>
            </div>

            <!-- Filters -->
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

            <!-- The feed -->
            <ol class="min-h-0 flex-1 overflow-y-auto px-[6%] py-3" data-testid="news-list">
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
                                  → ${item.effects.join(' · ')}
                                </div>`
                              : nothing
                          }
                        </li>
                      `,
                    )
              }
            </ol>

            <!-- Above the home bar -->
            <div class="px-[6%] pb-[6%] pt-2">
              <button
                class="btn btn-ghost w-full"
                data-testid="news-mark-read"
                @click=${() => this.handlers.markRead()}
              >
                Mark all as read
              </button>
            </div>
          </div>

          <img
            class="pointer-events-none absolute inset-0 h-full w-full select-none"
            src=${FRAME_TOP_URL}
            alt=""
          />
        </div>
      `,
      this.root,
    );
  }
}
