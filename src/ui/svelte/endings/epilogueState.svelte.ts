import { mount, unmount, type Component } from 'svelte';

import type { ChronicleEntry, Ending, NewsItem, RunStats, YearSummary } from '@sim/types';

import type { IconName } from '../../icons.ts';

import EpilogueView_ from './Epilogue.svelte';

export interface EpilogueView {
  ending: Ending;
  endedAt: number;
  estateCode: string;
  headline: NewsItem | null;
  stats: RunStats;
  cash: number;
  profitTotal: number;
  years: readonly YearSummary[];
  forestCover: number;
  matureHectares: number;
  letters: number;
  insolventFor: number;
  chronicle: readonly ChronicleEntry[];
  /** Years with a start-of-year snapshot, newest first. */
  rewindYears: readonly number[];
}

export interface EpilogueHandlers {
  rewind(year: number): void;
  keepPlaying(): void;
  newEstate(): void;
}

export interface Look {
  /** Message keys: the small line above the title, the title, the one-line verdict. */
  kicker: string;
  title: string;
  line: string;
  icon: IconName;
  /** Header band and badge colours. */
  band: string;
  badge: string;
  titleColor: string;
  /** What the number grid is called, as a message key. */
  numbers: string;
}

const WIN_BAND = 'linear-gradient(180deg, #fff3cd, #ffe9a8)';
const LOSS_BAND = 'linear-gradient(180deg, #ffd9cc, #f9c5b5)';

export const LOOK: Record<Ending, Look> = {
  clean: {
    kicker: 'epilogue.kickerCertified',
    title: 'epilogue.titleCertified',
    line: 'epilogue.lineClean',
    icon: 'certificate-palm',
    band: WIN_BAND,
    badge: '#fff9e6',
    titleColor: '#4a3320',
    numbers: 'epilogue.numbers',
  },
  dirty: {
    kicker: 'epilogue.kickerCertified',
    title: 'epilogue.titleCertified',
    line: 'epilogue.lineDirty',
    icon: 'certificate-palm',
    band: WIN_BAND,
    badge: '#fff9e6',
    titleColor: '#4a3320',
    numbers: 'epilogue.numbers',
  },
  reboisasi: {
    kicker: 'epilogue.kickerReboisasi',
    title: 'epilogue.titleReboisasi',
    line: 'epilogue.lineReboisasi',
    icon: 'forest-cover',
    band: 'linear-gradient(180deg, #e4f6dc, #c9ecbd)',
    badge: '#f1faec',
    titleColor: '#2f7a2b',
    numbers: 'epilogue.numbers',
  },
  redemption: {
    kicker: 'epilogue.kickerRedemption',
    title: 'epilogue.titleRedemption',
    line: 'epilogue.lineRedemption',
    icon: 'shop-sapling',
    band: 'linear-gradient(180deg, #ffe9c9, #d9edbe)',
    badge: '#f6fbec',
    titleColor: '#2f7a2b',
    numbers: 'epilogue.numbers',
  },
  fade: {
    kicker: 'epilogue.kickerFade',
    title: 'epilogue.titleFade',
    line: 'epilogue.lineFade',
    icon: 'calendar',
    band: 'linear-gradient(180deg, #e3eef8, #cddbe0)',
    badge: '#f4f8fb',
    titleColor: '#2f56b8',
    numbers: 'epilogue.numbers',
  },
  bankrupt: {
    kicker: 'epilogue.kickerLoss',
    title: 'epilogue.titleBankrupt',
    line: 'epilogue.lineBankrupt',
    icon: 'coin',
    band: LOSS_BAND,
    badge: '#fff1ec',
    titleColor: '#9e2e20',
    numbers: 'epilogue.wentWrong',
  },
  banned: {
    kicker: 'epilogue.kickerLoss',
    title: 'epilogue.titleBanned',
    line: 'epilogue.lineBanned',
    icon: 'police-warning',
    band: LOSS_BAND,
    badge: '#fff1ec',
    titleColor: '#9e2e20',
    numbers: 'epilogue.wentWrong',
  },
  arrested: {
    kicker: 'epilogue.kickerLoss',
    title: 'epilogue.titleArrested',
    line: 'epilogue.lineArrested',
    icon: 'police-warning',
    band: LOSS_BAND,
    badge: '#fff1ec',
    titleColor: '#9e2e20',
    numbers: 'epilogue.wentWrong',
  },
};

/**
 * How many ways a run can end, for the title screen's fact pill: the clean
 * and the persuaded certificate read as one ending to the player.
 */
export const ENDING_COUNT = Object.values(LOOK).filter(
  (look, i, all) => all.findIndex((other) => other.title === look.title) === i,
).length;

export class Epilogue {
  readonly ui = $state({ timelineOpen: false });
  view = $state.raw<EpilogueView | null>(null);
  private readonly target: HTMLElement;
  private readonly instance: ReturnType<Component>;

  constructor(
    parent: HTMLElement,
    readonly handlers: EpilogueHandlers,
  ) {
    this.target = document.createElement('div');
    parent.appendChild(this.target);
    this.instance = mount(EpilogueView_, { target: this.target, props: { epilogue: this } });
  }

  get isOpen(): boolean {
    return this.view !== null;
  }

  show(view: EpilogueView): void {
    this.ui.timelineOpen = false;
    this.view = view;
  }

  hide(): void {
    this.view = null;
  }

  dispose(): void {
    unmount(this.instance);
    this.target.remove();
  }
}
