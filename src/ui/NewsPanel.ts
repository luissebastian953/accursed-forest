/**
 * The news panel (§8 panel 13): the full feed, newest first, with lane
 * filters and a "what this does to you" line per item. Clicking an item with
 * blocks focuses the map on them.
 */

import { html, nothing, render } from 'lit-html';

import type { BlockId, NewsItem } from '@sim/types';

import { formatDate } from './format.ts';
import { icon } from './icons.ts';
import { LANE_LABEL, LANE_TONE } from './NewsTicker.ts';

export interface NewsPanelHandlers {
  focus(block: BlockId): void;
  close(): void;
}

type Filter = NewsItem['lane'] | 'all';

export class NewsPanel {
  private readonly root: HTMLElement;
  private open = false;
  private filter: Filter = 'all';
  private news: readonly NewsItem[] = [];

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

  show(news: readonly NewsItem[]): void {
    this.open = true;
    this.news = news;
    this.render();
  }

  hide(): void {
    this.open = false;
    this.render();
  }

  /** Re-render if open and the feed grew. */
  update(news: readonly NewsItem[]): void {
    if (!this.open) return;
    if (news.length === this.news.length && news.at(-1) === this.news.at(-1)) return;
    this.news = news;
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
      html`
        <div
          class="card absolute top-24 bottom-14 left-3 z-20 flex w-[28rem] max-w-[calc(100vw-1.5rem)] flex-col overflow-hidden text-sm"
          data-testid="news-panel"
        >
          <div class="flex items-center justify-between gap-2 border-b-2 border-[#f2e0b0] p-3">
            <div class="flex items-center gap-2 font-extrabold">${icon('news')} News</div>
            <div class="flex gap-1 text-xs">
              ${filters.map(
                (f) => html`
                  <button
                    class=${`btn btn-sm ${this.filter === f ? 'btn-green' : 'btn-ghost'}`}
                    data-testid=${`news-filter-${f}`}
                    @click=${() => {
                      this.filter = f;
                      this.render();
                    }}
                  >
                    ${f === 'all' ? 'All' : LANE_LABEL[f]}
                  </button>
                `,
              )}
            </div>
            <button class="btn btn-close" aria-label="Close" @click=${() => this.handlers.close()}>
              ✕
            </button>
          </div>
          <ol class="flex-1 overflow-y-auto p-2" data-testid="news-list">
            ${
              items.length === 0
                ? html`<li class="muted p-3 text-xs">Nothing in the news yet.</li>`
                : items.map(
                    (item) => html`
                      <li
                        class=${`pill-muted mb-1.5 p-2.5 ${item.blocks?.length ? 'cursor-pointer hover:brightness-[1.03]' : ''}`}
                        data-testid="news-item"
                        @click=${() => {
                          const first = item.blocks?.[0];
                          if (first !== undefined) this.handlers.focus(first);
                        }}
                      >
                        <div class="mb-0.5 flex items-center gap-2 text-[11px]">
                          <span
                            class=${`rounded-full px-2 py-px font-extrabold text-white ${LANE_TONE[item.lane]}`}
                            >${LANE_LABEL[item.lane]}</span
                          >
                          <span class="num muted">${formatDate(item.tick)}</span>
                          ${
                            item.severity === 'critical' || item.severity === 'warning'
                              ? html`<span
                                  class=${item.severity === 'critical' ? 'font-extrabold text-[#9e2e20]' : 'font-extrabold text-[#b85e12]'}
                                  >${item.severity}</span
                                >`
                              : nothing
                          }
                        </div>
                        <div class="font-extrabold leading-snug">${item.title}</div>
                        <div class="muted mt-0.5 text-xs leading-snug">${item.body}</div>
                        ${
                          item.effects.length > 0
                            ? html`<div class="mt-1 text-xs font-bold text-[#b85e12]">
                                → ${item.effects.join(' · ')}
                              </div>`
                            : nothing
                        }
                      </li>
                    `,
                  )
            }
          </ol>
        </div>
      `,
      this.root,
    );
  }
}
