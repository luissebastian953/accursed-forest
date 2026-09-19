import { mount, unmount, type Component } from 'svelte';

import type { NewsItem } from '@sim/types';

import NewsTickerView from './NewsTicker.svelte';

export interface TickerHandlers {
  open(): void;
}

interface TickerItem {
  tick: number;
  title: string;
  lane: NewsItem['lane'];
  testId: string;
}

interface TickerState {
  items: TickerItem[];
  unread: number;
  hidden: boolean;
}

const state = $state<TickerState>({ items: [], unread: 0, hidden: false });

export function tickerState(): TickerState {
  return state;
}

export class NewsTicker {
  private readonly target: HTMLElement;
  private readonly instance: ReturnType<Component>;
  /** The App calls `update` every frame; only a changed feed touches the state. */
  private lastKey = '';

  constructor(parent: HTMLElement, handlers: TickerHandlers) {
    this.target = document.createElement('div');
    parent.appendChild(this.target);
    this.instance = mount(NewsTickerView, { target: this.target, props: { handlers } });
  }

  /** Slide the ticker down out of the way (the title screens) and back. */
  setHidden(hidden: boolean): void {
    state.hidden = hidden;
  }

  update(news: readonly NewsItem[], unread: number): void {
    const latest = news.at(-1);
    const key = `${news.length}:${latest?.tick ?? -1}:${latest?.title ?? ''}:${unread}`;

    if (key === this.lastKey) return;
    this.lastKey = key;
    state.items = news
      .slice(-3)
      .reverse()
      .map((item, i) => ({
        tick: item.tick,
        title: item.title,
        lane: item.lane,
        testId: i === 0 ? 'news-ticker-latest' : '',
      }));
    state.unread = unread;
  }

  dispose(): void {
    unmount(this.instance);
    this.target.remove();
  }
}
