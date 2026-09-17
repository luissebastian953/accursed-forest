/**
 * The menu (§8 panel 16): save, load, a new estate by code, and the language.
 * `Menu` keeps the lit-html version's constructor and
 * `toggle`/`show`/`hide`/`update`/`isOpen`/`dispose` surface so `App.ts` is
 * unchanged; the view reads `state` and calls back into the class.
 */

import { mount, unmount, type Component } from 'svelte';

import { seedFromEstateCode } from '@sim/index';

import MenuPanel from './Menu.svelte';

export interface MenuView {
  estateCode: string;
  hasSave: boolean;
  lastSavedAt: string | null;
  saveError: string | null;
}

export interface MenuHandlers {
  newGame(seed: number): void;
  save(): void;
  load(): void;
}

export interface MenuState {
  open: boolean;
  view: MenuView;
  code: string;
  codeError: boolean;
}

export class Menu {
  readonly state = $state<MenuState>({
    open: false,
    view: { estateCode: '', hasSave: false, lastSavedAt: null, saveError: null },
    code: '',
    codeError: false,
  });
  private readonly target: HTMLElement;
  private readonly instance: ReturnType<Component>;

  constructor(
    parent: HTMLElement,
    readonly handlers: MenuHandlers,
  ) {
    this.target = document.createElement('div');
    parent.appendChild(this.target);
    this.instance = mount(MenuPanel, { target: this.target, props: { menu: this } });
  }

  get isOpen(): boolean {
    return this.state.open;
  }

  toggle(): void {
    this.state.open = !this.state.open;
  }

  show(): void {
    this.state.open = true;
  }

  hide(): void {
    this.state.open = false;
  }

  update(view: MenuView): void {
    this.state.view = view;
  }

  dispose(): void {
    unmount(this.instance);
    this.target.remove();
  }

  startNew(): void {
    const trimmed = this.state.code.trim();
    let seed: number;
    if (trimmed.length === 0) {
      const buffer = new Uint32Array(1);
      crypto.getRandomValues(buffer);
      seed = buffer[0]!;
    } else {
      const parsed = seedFromEstateCode(trimmed);
      if (parsed === null) {
        this.state.codeError = true;
        return;
      }
      seed = parsed;
    }
    this.state.code = '';
    this.state.codeError = false;
    this.hide();
    this.handlers.newGame(seed);
  }
}
