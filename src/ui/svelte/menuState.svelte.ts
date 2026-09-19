/**
 * The menu (§8 panel 16): save, load, a new estate by code, and the language.
 * `Menu` keeps the pre-Svelte constructor and
 * `toggle`/`show`/`hide`/`update`/`isOpen`/`dispose` surface so `App.ts` is
 * unchanged; the view reads `state` and calls back into the class.
 */

import { mount, unmount, type Component } from 'svelte';

import { estateCodeFor, seedFromEstateCode } from '@sim/index';

import MenuPanel from './Menu.svelte';

export interface MenuView {
  estateCode: string;
  /** What the player called this estate, or '' if they did not name it. */
  estateName: string;
  hasSave: boolean;
  lastSavedAt: string | null;
  saveError: string | null;
  /** Whether the estate makes a sound. */
  sound: boolean;
}

export interface MenuHandlers {
  newGame(seed: number, name: string): void;
  save(): void;
  load(): void;
  setSound(on: boolean): void;
}

export interface MenuState {
  open: boolean;
  view: MenuView;
  /** What the new estate would be called. */
  name: string;
  /** The seed for the new estate: a code, or words, or empty for a random one. */
  code: string;
  codeError: boolean;
}

export class Menu {
  readonly state = $state<MenuState>({
    open: false,
    view: {
      estateCode: '',
      estateName: '',
      hasSave: false,
      lastSavedAt: null,
      saveError: null,
      sound: true,
    },
    name: '',
    code: '',
    codeError: false,
  });
  private readonly target: HTMLElement;
  private readonly instance: ReturnType<Component>;
  /** The estate name the box was last filled from. */
  private namedFor: string | null = null;

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

  /**
   * What the header shows: the estate being played, or, once the player types
   * into either box, the estate they are about to start. The name alone is
   * enough to settle the code, so it changes as they type.
   */
  get preview(): { name: string; code: string; isNew: boolean } {
    const name = this.state.name.trim();
    const code = this.state.code.trim();
    // The name box opens on the estate being played, so an untouched pair of
    // boxes still describes that estate and not a new one.
    if (code === '' && (name === '' || name === this.state.view.estateName)) {
      return { name: this.state.view.estateName, code: this.state.view.estateCode, isNew: false };
    }
    const seed = seedFromEstateCode(code === '' ? name : code);
    return {
      name,
      // An empty seed box and an empty name means a world drawn at random,
      // which has no code until it exists.
      code: seed === null ? '' : estateCodeFor(seed),
      isNew: true,
    };
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
    // The name box starts on what this estate is called, so a player renaming
    // one is editing rather than retyping. Only refilled while the menu is
    // shut, or when the estate itself changed: never over what is being typed.
    if (!this.state.open || this.namedFor !== view.estateName) {
      this.state.name = view.estateName;
      this.namedFor = view.estateName;
    }
  }

  dispose(): void {
    unmount(this.instance);
    this.target.remove();
  }

  startNew(): void {
    const name = this.state.name.trim();
    const code = this.state.code.trim();
    // The seed box wins when it is filled; otherwise the name settles the
    // world, and an empty pair of boxes draws one at random.
    const from = code === '' ? name : code;
    let seed: number;
    if (from === '') {
      const buffer = new Uint32Array(1);
      crypto.getRandomValues(buffer);
      seed = buffer[0]!;
    } else {
      const parsed = seedFromEstateCode(from);
      if (parsed === null) {
        this.state.codeError = true;
        return;
      }
      seed = parsed;
    }
    this.state.code = '';
    this.state.codeError = false;
    this.hide();
    this.handlers.newGame(seed, name);
  }
}
