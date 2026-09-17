/**
 * The authorities' paperwork (§8 panel 17b): the letter, the investigation
 * notice with its "settle the matter" option when integrity allows, and the
 * operating ban (§3.8). The arrest is an ending; the epilogue tells it.
 * `AuthorityCards` keeps the pre-Svelte constructor and
 * `show`/`hide`/`showing`/`dispose` surface so `App.ts` is unchanged.
 */

import { mount, unmount, type Component } from 'svelte';

import type { NewsItem, Rejection } from '@sim/types';

import AuthorityCardsView from './AuthorityCards.svelte';

export type CardKind = 'letter' | 'investigation' | 'ban';

export interface CardView {
  kind: CardKind;
  tick: number;
  headline: NewsItem | null;
  /** Investigation and operating ban: when it lifts. */
  until: number | null;
  settleCost: number | null;
  settleRejection: Rejection | null;
}

export interface CardHandlers {
  dismiss(): void;
  settle(): void;
}

export class AuthorityCards {
  readonly state = $state<{ view: CardView | null }>({ view: null });
  private readonly target: HTMLElement;
  private readonly instance: ReturnType<Component>;

  constructor(
    parent: HTMLElement,
    readonly handlers: CardHandlers,
  ) {
    this.target = document.createElement('div');
    parent.appendChild(this.target);
    this.instance = mount(AuthorityCardsView, { target: this.target, props: { cards: this } });
  }

  get showing(): CardKind | null {
    return this.state.view?.kind ?? null;
  }

  show(view: CardView): void {
    this.state.view = view;
  }

  hide(): void {
    this.state.view = null;
  }

  dispose(): void {
    unmount(this.instance);
    this.target.remove();
  }
}
