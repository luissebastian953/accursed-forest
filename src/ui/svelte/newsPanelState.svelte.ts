/**
 * The news panel (§8 panel 13): the full feed, newest first, with lane
 * filters and a "what this does to you" line per item, on the phone.
 * `NewsPanel` keeps the pre-Svelte constructor and
 * `show`/`hide`/`update`/`isOpen`/`dispose` surface so `App.ts` is
 * unchanged. The feed itself is held raw: it is the sim's own array, read,
 * never mutated here, and far too big to proxy.
 */

import { mount, unmount, type Component } from 'svelte';

import type { BlockId, NewsItem } from '@sim/types';

import NewsPanelView from './NewsPanel.svelte';

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

export type NewsFilter = NewsItem['lane'] | 'all';

export class NewsPanel {
  readonly ui = $state<{ open: boolean; filter: NewsFilter }>({ open: false, filter: 'all' });
  feed = $state.raw<{ news: readonly NewsItem[]; status: NewsStatus }>({
    news: [],
    status: { tick: 0, unread: 0 },
  });
  private readonly target: HTMLElement;
  private readonly instance: ReturnType<Component>;

  constructor(
    parent: HTMLElement,
    readonly handlers: NewsPanelHandlers,
  ) {
    this.target = document.createElement('div');
    parent.appendChild(this.target);
    this.instance = mount(NewsPanelView, { target: this.target, props: { panel: this } });
  }

  get isOpen(): boolean {
    return this.ui.open;
  }

  show(news: readonly NewsItem[], status: NewsStatus): void {
    this.feed = { news, status };
    this.ui.open = true;
  }

  hide(): void {
    this.ui.open = false;
  }

  /** Re-render if open and the feed grew or the badge changed. */
  update(news: readonly NewsItem[], status: NewsStatus): void {
    if (!this.ui.open) return;
    const current = this.feed;
    const same =
      news.length === current.news.length &&
      news.at(-1) === current.news.at(-1) &&
      status.unread === current.status.unread &&
      status.tick === current.status.tick;
    if (same) return;
    this.feed = { news, status };
  }

  dispose(): void {
    unmount(this.instance);
    this.target.remove();
  }
}
