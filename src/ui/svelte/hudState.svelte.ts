import { mount, unmount, type Component } from 'svelte';

import type { Speed } from '@app/timeControl';
import type { ClimateRegime, SkyCondition } from '@sim/types';

import HudView_ from './Hud.svelte';

/** One chip in the active-events strip (§8 panel 6). */
export interface EventChip {
  id: string;
  label: string;
  /** Days left, or null for events that last as long as their cause. */
  daysLeft: number | null;
  tone: 'fire' | 'smoke' | 'ash' | 'water' | 'dry' | 'pest' | 'econ';
}

export interface HudView {
  cash: number;
  tick: number;
  tbsPrice: number;
  /** -1 falling, 0 flat, 1 rising, against ~10 days ago. */
  tbsTrend: -1 | 0 | 1;
  regime: ClimateRegime;
  rain: number;
  /** Today's sky (§3.6): what the climate tile actually shows. */
  sky: SkyCondition;
  speed: Speed;
  locked: boolean;
  /** 0 when there is no Kopdes yet; gates the 50x button (§3.3). */
  kopdesLevel: number;
  estateCode: string;
  /** Whether the estate makes a sound; the speaker button reads it. */
  sound: boolean;
  /** What the player called this estate, or '' if they did not name it. */
  estateName: string;
  saveNote: string | null;
  saveError: string | null;
  /** §8 panel 5: shown once any burn has happened. */
  firePressure: number;
  fireThreshold: number;
  burningCount: number;
  wildfire: boolean;
  /** §8 panel 5b: shown only once the first letter has arrived (§3.9); null hides it. */
  attention: number | null;
  /** §8 panel 1: the input price index, shown once it moves off 1. */
  inputIndex: number;
  /** §8 panel 1: share of forest across the estate's neighbourhood, 0..1. */
  forestCover: number;
  /** §8 panel 6: haze, ash, flood, drought, wildfire, plague. */
  events: EventChip[];
  /** §8 panel 19: ISPO conditions met, from Year 3; null hides the button. */
  ispoMet: number | null;
  /** How many there are to meet, so the pips are not a magic number. */
  ispoTotal: number;
}

export interface HudHandlers {
  setSpeed(speed: Speed): void;
  openMenu(): void;
  /** The speaker button beside the menu. */
  setSound(on: boolean): void;
  openCertificate(): void;
  openHelp(): void;
}

export class Hud {
  readonly ui = $state({ hidden: false });
  view = $state.raw<HudView | null>(null);
  private readonly target: HTMLElement;
  private readonly instance: ReturnType<Component>;

  constructor(
    parent: HTMLElement,
    readonly handlers: HudHandlers,
  ) {
    this.target = document.createElement('div');
    parent.appendChild(this.target);
    this.instance = mount(HudView_, { target: this.target, props: { hud: this } });
  }

  /** Slide the bar up out of the way (the title screens) and back. */
  setHidden(hidden: boolean): void {
    this.ui.hidden = hidden;
  }

  update(view: HudView): void {
    this.view = view;
  }

  dispose(): void {
    unmount(this.instance);
    this.target.remove();
  }
}
