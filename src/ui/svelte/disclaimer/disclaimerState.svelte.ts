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
  readonly ui = $state<{ open: boolean }>({ open: false });
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

  /** Close it and remember, so the gate is passed once per browser, not once per visit. */
  accept(): void {
    this.ui.open = false;

    try {
      localStorage.setItem(STORAGE_KEY, VERSION);
    } catch {
      // Session only, then.
    }

    this.handlers.accept();
  }

  dispose(): void {
    unmount(this.instance);
    this.target.remove();
  }
}
