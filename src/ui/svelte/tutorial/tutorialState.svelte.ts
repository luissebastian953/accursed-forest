import { mount, unmount, type Component } from 'svelte';

import type { Sim } from '@sim/index';
import type { BlockId } from '@sim/types';

import { STEPS, firstUndone, pickFieldBlock, type Probe, type Step, type StepId } from './steps.ts';
import TutorialView from './Tutorial.svelte';

const STORAGE_KEY = 'sawit:tutorial';
const DONE = '1';

/** A block's top face on screen, four corners in CSS pixels, clockwise from the far corner. */
export interface ScreenQuad {
  points: [number, number][];
}

export interface TutorialHandlers {
  select(block: BlockId | null): void;
  /** Bring the camera to a block the player has wandered away from. */
  focus(block: BlockId): void;
  openShop(): void;
  closeShop(): void;
  /** The crew only works while the clock runs; a paused estate is nudged to 1x. */
  resumeClock(): void;
  /** Where a block's top face is on screen right now, or null when it is behind the camera. */
  project(block: BlockId): ScreenQuad | null;
}

/** Whether this browser has been through the walkthrough, or skipped it. */
export function tutorialDone(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === DONE;
  } catch {
    return false;
  }
}

function markDone(): void {
  try {
    localStorage.setItem(STORAGE_KEY, DONE);
  } catch {
    // Storage off: it will ask again next visit.
  }
}

export class Tutorial {
  readonly ui = $state<{
    active: boolean;
    /** Index into `STEPS`; `STEPS.length` once the last one is behind the player. */
    index: number;
    /** The finishing card is up. */
    complete: boolean;
    /** The step's target is not on screen, so the pill offers to show it again. */
    lost: boolean;
    /** Bumped on every step change, so the view re-anchors from scratch. */
    generation: number;
  }>({ active: false, index: 0, complete: false, lost: false, generation: 0 });
  sim = $state.raw<Sim | null>(null);
  /** The block chosen for the chop, kept for the run so the steps agree on it. */
  field: BlockId | null = null;
  private readonly target: HTMLElement;
  private readonly instance: ReturnType<Component>;

  constructor(
    parent: HTMLElement,
    readonly handlers: TutorialHandlers,
  ) {
    this.target = document.createElement('div');
    parent.appendChild(this.target);
    this.instance = mount(TutorialView, { target: this.target, props: { tutorial: this } });
  }

  get active(): boolean {
    return this.ui.active;
  }

  get step(): Step | null {
    return this.ui.active && !this.ui.complete ? (STEPS[this.ui.index] ?? null) : null;
  }

  get stepId(): StepId | null {
    return this.step?.id ?? null;
  }

  get stepCount(): number {
    return STEPS.length;
  }

  /** Walk a fresh estate through from the first block; a run already under way picks up where it is. */
  start(sim: Sim): void {
    this.sim = sim;
    this.field = pickFieldBlock(sim);
    this.begin();
  }

  private begin(): void {
    this.selected = null;
    this.shopOpen = false;
    this.ui.active = true;
    this.ui.complete = false;
    this.ui.lost = false;
    this.ui.index = -1;
    this.goTo(0, this.probe());
  }

  /** Take the overlay down without deciding anything: a new estate is starting. */
  stop(): void {
    this.ui.active = false;
    this.ui.complete = false;
    this.sim = null;
  }

  skip(): void {
    markDone();
    this.stop();
  }

  /** Start playing: the walkthrough is over for this browser. */
  finish(): void {
    markDone();
    this.stop();
  }

  /** From the finishing card: the same field, so the estate steps are behind it and the guide is not. */
  replay(): void {
    if (!this.sim) return;
    // The card was reached from the shop, which would otherwise stay up over the guide.
    this.handlers.closeShop();
    this.begin();
  }

  /** The Next button on a guide step. */
  next(): void {
    if (!this.sim || !this.step?.next) return;
    this.goTo(this.ui.index + 1, this.probe());
  }

  /** Run the step's opening move again: the player closed what it was pointing at. */
  showMe(): void {
    const step = this.step;

    if (!this.sim || !step) return;
    this.enter(step);

    const block = step.block === 'kopdes' ? this.kopdesBlock() : this.field;

    if (block !== null) this.handlers.focus(block);
  }

  /** The view reports whether it found the step's target; the pill answers with Show me. */
  setLost(lost: boolean): void {
    if (this.ui.lost !== lost) this.ui.lost = lost;
  }

  /** Read the estate: every step already behind the player is passed over. */
  sync(sim: Sim, selected: BlockId | null, shopOpen: boolean): void {
    if (!this.ui.active || this.ui.complete) return;
    this.sim = sim;
    this.selected = selected;
    this.shopOpen = shopOpen;

    const probe = this.probe();
    const next = firstUndone(this.ui.index, probe);

    if (next !== this.ui.index) this.goTo(next, probe);
  }

  dispose(): void {
    unmount(this.instance);
    this.target.remove();
  }

  /** The interface as `sync` last saw it, so a step's opening move is not repeated. */
  private selected: BlockId | null = null;
  private shopOpen = false;

  private probe(): Probe {
    return { sim: this.sim!, field: this.field, selected: this.selected, shopOpen: this.shopOpen };
  }

  private kopdesBlock(): BlockId {
    const sim = this.sim!;

    return sim.state.kopdes?.blockId ?? sim.state.worldGen.kopdesBlock;
  }

  /** Land on `index`, or the first step past it that still wants doing. */
  private goTo(index: number, probe: Probe): void {
    const at = firstUndone(index, probe);

    this.ui.index = at;
    this.ui.lost = false;
    this.ui.generation += 1;

    const step = STEPS[at];

    if (!step) {
      this.ui.complete = true;
      return;
    }

    this.enter(step);
    if (step.id === 'clearing') this.handlers.resumeClock();
  }

  private enter(step: Step): void {
    const want =
      step.enter === 'selectKopdes'
        ? this.kopdesBlock()
        : step.enter === 'selectField'
          ? this.field
          : null;

    switch (step.enter) {
      case 'selectKopdes':
      case 'selectField':
      case 'deselect':
        if (want !== this.selected) {
          this.handlers.select(want);
          this.selected = want;
        }

        break;
      case 'openShop':
        if (!this.shopOpen) {
          this.handlers.openShop();
          this.shopOpen = true;
        }

        break;
      case null:
        break;
    }
  }
}
