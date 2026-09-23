import { mount, unmount, type Component } from 'svelte';

import type { CertificateCondition } from '@sim/systems/endings';
import type { YearSummary } from '@sim/types';

import CertificatePanelView from './CertificatePanel.svelte';
import YearEndCardView from './YearEndCard.svelte';

export interface CertificateHandlers {
  close(): void;
}

export interface CertificateView {
  conditions: readonly CertificateCondition[];
  /** The forest win already standing, which dresses the band (GDD 3.10). */
  reforest: 'reboisasi' | 'redemption' | null;
  /** Days until the Ministry next looks, which is the next year's close. */
  daysToCheck: number;
  /** Day of the run, for naming the check. */
  checkDay: number;
}

/** The checklist popover under the top bar. */
export class CertificatePanel {
  readonly state = $state<{ view: CertificateView | null }>({ view: null });
  private readonly target: HTMLElement;
  private readonly instance: ReturnType<Component>;

  constructor(
    parent: HTMLElement,
    readonly handlers: CertificateHandlers,
  ) {
    this.target = document.createElement('div');
    parent.appendChild(this.target);
    this.instance = mount(CertificatePanelView, { target: this.target, props: { panel: this } });
  }

  get isOpen(): boolean {
    return this.state.view !== null;
  }

  show(view: CertificateView): void {
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

export interface YearEndView {
  summary: YearSummary;
  previous: YearSummary | null;
  /** Null before the checklist is shown (GDD 8 panel 19: from Year 3). */
  conditionsMet: number | null;
}

/** The New Year card: not modal, and it gets out of the way on its own. */
export class YearEndCard {
  readonly state = $state<{ view: YearEndView | null }>({ view: null });
  private readonly target: HTMLElement;
  private readonly instance: ReturnType<Component>;
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor(parent: HTMLElement) {
    this.target = document.createElement('div');
    parent.appendChild(this.target);
    this.instance = mount(YearEndCardView, { target: this.target, props: { card: this } });
  }

  get isOpen(): boolean {
    return this.state.view !== null;
  }

  show(view: YearEndView, holdMs = 12_000): void {
    this.state.view = view;
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = setTimeout(() => this.hide(), holdMs);
  }

  hide(): void {
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;
    this.state.view = null;
  }

  dispose(): void {
    this.hide();
    unmount(this.instance);
    this.target.remove();
  }
}
