/**
 * Controls (§8 panel 4): which button does what, in a popover from the top
 * bar's "?" button or the H key. `ControlsHelp` keeps the pre-Svelte
 * constructor and `toggle`/`show`/`hide`/`isOpen`/`dispose` surface so
 * `App.ts` is unchanged.
 */

import { mount, unmount, type Component } from 'svelte';

import ControlsHelpView from './ControlsHelp.svelte';

export interface ControlsHelpHandlers {
  close(): void;
}

const state = $state({ open: false });

export function controlsHelpState(): { open: boolean } {
  return state;
}

export class ControlsHelp {
  private readonly target: HTMLElement;
  private readonly instance: ReturnType<Component>;

  constructor(parent: HTMLElement, handlers: ControlsHelpHandlers) {
    this.target = document.createElement('div');
    parent.appendChild(this.target);
    this.instance = mount(ControlsHelpView, { target: this.target, props: { handlers } });
  }

  get isOpen(): boolean {
    return state.open;
  }

  toggle(): void {
    state.open = !state.open;
  }

  show(): void {
    state.open = true;
  }

  hide(): void {
    state.open = false;
  }

  dispose(): void {
    unmount(this.instance);
    this.target.remove();
  }
}
