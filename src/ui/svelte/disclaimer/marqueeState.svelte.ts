import { mount, unmount, type Component } from 'svelte';

import MarqueeView from './Marquee.svelte';

export interface MarqueeHandlers {
  open(): void;
}

export class Marquee {
  private readonly target: HTMLElement;
  private readonly instance: ReturnType<Component>;

  constructor(parent: HTMLElement, handlers: MarqueeHandlers) {
    this.target = document.createElement('div');
    parent.appendChild(this.target);
    this.instance = mount(MarqueeView, { target: this.target, props: { handlers } });
  }

  dispose(): void {
    unmount(this.instance);
    this.target.remove();
  }
}
