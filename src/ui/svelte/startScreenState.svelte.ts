/**
 * The title screen (§8 panel 1, design kit 5a): a modal over the live estate,
 * pulled back so the terrain reads as a dimmed backdrop. Two states:
 *
 *   - first launch, or nothing saved in this browser: the large start card;
 *     Start a game, an estate code to share a world, How to play, Settings,
 *     and three facts drawn from the balance tables;
 *   - a save in this browser: the medium "welcome back" card; the estate,
 *     when it was saved, where it stands, what is going on there, Continue,
 *     and the ways out (the menu's saves and codes, or a new estate).
 *
 * On start or continue the card fades and the camera pulls in; the App owns
 * that camera move. `StartScreen` keeps the pre-Svelte constructor
 * and `show`/`dismiss`/`isOpen`/`dispose` surface so `App.ts` is unchanged.
 */

import { mount, unmount, type Component } from 'svelte';

import { estateCodeFor, seedFromEstateCode } from '@sim/index';

import type { IconName } from '../icons.ts';

import StartScreenView_ from './StartScreen.svelte';

/** What the welcome-back card says about the save. */
export interface SaveSummary {
  code: string;
  /** ISO timestamp of the last save, if the manifest has one. */
  savedAt: string | null;
  year: number;
  day: number;
  plantedHectares: number;
  cash: number;
  /** What is going on there: weather events, pests, the checklist. */
  chips: {
    icon: IconName;
    label: string;
    tone: 'fire' | 'smoke' | 'ash' | 'water' | 'dry' | 'pest' | 'econ' | 'plain';
  }[];
}

export interface StartScreenView {
  /** The estate a fresh start would open on. */
  estateCode: string;
  /** What that estate is called, or '' if it was never named. */
  estateName: string;
  /** The saved estate to continue, if there is one. */
  save: SaveSummary | null;
  /** The footer line: version and renderer. */
  build: string;
}

export interface StartScreenHandlers {
  /** Start the current (or freshly coded) estate. */
  start(): void;
  /** Continue the saved estate. */
  resume(): void;
  /** Leave the save behind and start a random new estate. */
  newEstate(): void;
  /** The menu: saves and estate codes. */
  loadOther(): void;
  /**
   * Swap the current estate for the one these boxes describe; an error string
   * if the seed cannot be read. An empty seed means the name settles it.
   */
  useCode(seed: string, name: string): string | null;
  howToPlay(): void;
  settings(): void;
}

/** How long the fade takes; the App times the camera pull-in to match. */
export const START_FADE_MS = 650;

export class StartScreen {
  readonly ui = $state<{
    open: boolean;
    leaving: boolean;
    name: string;
    code: string;
    error: string | null;
  }>({
    open: false,
    leaving: false,
    name: '',
    code: '',
    error: null,
  });
  view = $state.raw<StartScreenView>({
    estateCode: '',
    estateName: '',
    save: null,
    build: '',
  });
  private readonly target: HTMLElement;
  private readonly instance: ReturnType<Component>;

  constructor(
    parent: HTMLElement,
    readonly handlers: StartScreenHandlers,
  ) {
    this.target = document.createElement('div');
    parent.appendChild(this.target);
    this.instance = mount(StartScreenView_, { target: this.target, props: { screen: this } });
  }

  get isOpen(): boolean {
    return this.ui.open;
  }

  /**
   * The estate the card is offering: the one behind the title until the player
   * types, then the one their boxes describe. The name alone settles the code,
   * so it moves as they type.
   */
  get preview(): { name: string; code: string; isNew: boolean } {
    const name = this.ui.name.trim();
    const code = this.ui.code.trim();
    if (name === '' && code === '') {
      return { name: this.view.estateName, code: this.view.estateCode, isNew: false };
    }
    const seed = seedFromEstateCode(code === '' ? name : code);
    return { name, code: seed === null ? '' : estateCodeFor(seed), isNew: true };
  }

  show(view: StartScreenView): void {
    this.view = view;
    this.ui.open = true;
    this.ui.leaving = false;
    this.ui.error = null;
  }

  /** Fade out, then unmount. */
  dismiss(): void {
    if (!this.ui.open || this.ui.leaving) return;
    this.ui.leaving = true;
    setTimeout(() => {
      this.ui.open = false;
      this.ui.leaving = false;
    }, START_FADE_MS);
  }

  /** Start what the boxes describe, or the estate behind the title if empty. */
  submitCode(): void {
    const name = this.ui.name.trim();
    const code = this.ui.code.trim();
    this.ui.error = null;
    if (name === '' && code === '') {
      this.handlers.start();
      return;
    }
    this.ui.error = this.handlers.useCode(code, name);
  }

  dispose(): void {
    unmount(this.instance);
    this.target.remove();
  }
}
