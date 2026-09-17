/**
 * The news ticker (§8 panels 3 and 8): the latest three headlines along the
 * bottom, lane-coloured, with a badge for unread warnings. Click to open the
 * full feed. `NewsTicker` keeps the lit-html version's constructor and
 * `update`/`setHidden`/`dispose` surface so `App.ts` is unchanged.
 */

import { mount, unmount, type Component } from 'svelte';

import type { NewsItem } from '@sim/types';

import NewsTickerView from './NewsTicker.svelte';

export interface TickerHandlers {
  open(): void;
}

export interface TickerItem {
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
