/**
 * The menu (§8 panel 16): save, load, a new estate, and the language.
 * `Menu` keeps the pre-Svelte constructor and
 * `toggle`/`show`/`hide`/`update`/`isOpen`/`dispose` surface so `App.ts` is
 * unchanged; the view reads `state` and calls back into the class.
 *
 * Starting a new estate takes two steps (§8 panel 16a). A save is replaced
 * the moment a new world begins, so the boxes that describe one are kept off
 * the menu's face: the first step is a single button, the second is the form.
 * Anything that dismisses the menu puts it back on the first step, so nobody
 * reopens it to find a half-filled form pointed at their estate.
 */

import { mount, unmount, type Component } from 'svelte';

import { estateCodeFor, seedFromEstateCode } from '@sim/index';

import MenuPanel from './Menu.svelte';

export interface MenuView {
  estateCode: string;
  /** What the player called this estate, or '' if they did not name it. */
  estateName: string;
  /** Whether there is an estate in play: false while the title screen is up. */
  inPlay: boolean;
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

/** The menu's face, or the form that replaces it. */
export type MenuStep = 'default' | 'new';

export interface MenuState {
  open: boolean;
  view: MenuView;
  step: MenuStep;
  /** What the new estate would be called. */
  name: string;
  /** The seed for the new estate: a code, or words, or empty for a random one. */
  code: string;
}

export class Menu {
  readonly state = $state<MenuState>({
    open: false,
    view: {
      estateCode: '',
      estateName: '',
      inPlay: false,
      hasSave: false,
      lastSavedAt: null,
      saveError: null,
      sound: true,
    },
    step: 'default',
    name: '',
    code: '',
  });
  private readonly target: HTMLElement;
  private readonly instance: ReturnType<Component>;
  /** The estate name the box was last filled from. */
  private namedFor: string | null = null;
  /**
   * Whether the menu was opened straight into the form, from the title
   * card's "New estate". Cancel then means "never mind", not "back to the
   * menu the player never asked for".
   */
  private openedIntoForm = false;

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
   * The estate the form describes, as its boxes stand. The name alone settles
   * the code, so it moves as the player types; an empty pair means a world
   * drawn at random, which has no code until it exists.
   */
  get preview(): { code: string; random: boolean } {
    const name = this.state.name.trim();
    const code = this.state.code.trim();
    const from = code === '' ? name : code;
    if (from === '') return { code: '', random: true };
    const seed = seedFromEstateCode(from);
    return seed === null
      ? { code: '', random: true }
      : { code: estateCodeFor(seed), random: false };
  }

  toggle(): void {
    if (this.state.open) this.hide();
    else this.show();
  }

  show(): void {
    this.state.open = true;
  }

  hide(): void {
    this.state.open = false;
    // Dismissing the menu, however it is done, leaves the form behind.
    this.state.step = 'default';
    this.openedIntoForm = false;
  }

  /**
   * Step two: the boxes that describe a new estate.
   *
   * @param direct opened from outside the menu, so Cancel closes it.
   */
  openNew(direct = false): void {
    this.state.step = 'new';
    this.openedIntoForm = direct;
  }

  /** Back where the player came from, with nothing started. */
  cancelNew(): void {
    if (this.openedIntoForm) this.hide();
    else this.state.step = 'default';
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

  /** The one thing in the menu that replaces the estate in play. */
  create(): void {
    const name = this.state.name.trim();
    const code = this.state.code.trim();
    // The button is dead until the estate has a name, so there is always
    // something to seed from: the seed box when it is filled, the name when it
    // is not. A world drawn at random comes from the title card instead.
    if (name === '') return;
    const seed = seedFromEstateCode(code === '' ? name : code) ?? 0;
    this.state.code = '';
    this.hide();
    this.handlers.newGame(seed, name);
  }
}
