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
 * that camera move. `StartScreen` keeps the lit-html version's constructor
 * and `show`/`dismiss`/`isOpen`/`dispose` surface so `App.ts` is unchanged.
 */

import { mount, unmount, type Component } from 'svelte';

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
  /** Swap the current estate for the coded one; an error string if the code is bad. */
  useCode(code: string): string | null;
  howToPlay(): void;
  settings(): void;
}

/** How long the fade takes; the App times the camera pull-in to match. */
export const START_FADE_MS = 650;

export class StartScreen {
  readonly ui = $state<{ open: boolean; leaving: boolean; code: string; error: string | null }>({
    open: false,
    leaving: false,
    code: '',
    error: null,
  });
  view = $state.raw<StartScreenView>({ estateCode: '', save: null, build: '' });
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

  submitCode(): void {
    const trimmed = this.ui.code.trim();
    if (trimmed === '') {
      this.ui.error = null;
      this.handlers.start();
      return;
    }
    this.ui.error = this.handlers.useCode(trimmed);
  }

  dispose(): void {
    unmount(this.instance);
    this.target.remove();
  }
}
