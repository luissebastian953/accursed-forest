import { mount, unmount, type Component } from 'svelte';

import DisclaimerModalView from './DisclaimerModal.svelte';

const STORAGE_KEY = 'sawit:disclaimer';
/** Bump when the wording changes enough that a returning player should see it again. */
const VERSION = '1';

export interface DisclaimerHandlers {
  accept(): void;
}

/** Whether this browser has already acknowledged the current wording. */
export function disclaimerAccepted(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === VERSION;
  } catch {
    // Storage off: ask again, which errs on the side of it being read.
    return false;
  }
}

export class DisclaimerModal {
  readonly ui = $state<{ open: boolean; hushed: boolean }>({ open: false, hushed: false });
  private readonly target: HTMLElement;
  private readonly instance: ReturnType<Component>;

  constructor(
    parent: HTMLElement,
    readonly handlers: DisclaimerHandlers,
  ) {
    this.target = document.createElement('div');
    parent.appendChild(this.target);
    this.instance = mount(DisclaimerModalView, { target: this.target, props: { modal: this } });
  }

  get isOpen(): boolean {
    return this.ui.open;
  }

  show(): void {
    this.ui.open = true;
  }

  /** Tick the box, and the gate is passed once per browser rather than per visit. */
  hush(on: boolean): void {
    this.ui.hushed = on;
  }

  /** Unticked, the acknowledgement lasts this visit only: the gate comes back. */
  accept(): void {
    this.ui.open = false;

    if (this.ui.hushed) {
      try {
        localStorage.setItem(STORAGE_KEY, VERSION);
      } catch {
        // Session only, then.
      }
    }

    this.handlers.accept();
  }

  dispose(): void {
    unmount(this.instance);
    this.target.remove();
  }
}
