/**
 * The Kopdes shop (§8 panel 12): a Buy tab for inputs at `base × index`, a
 * Sell tab showing today's TBS price, the intake and recent sales, and the
 * building's upgrade. The range ring is drawn on the map while it is open.
 *
 * `KopdesShop` keeps the pre-Svelte constructor and
 * `open`/`close`/`toggle`/`refresh`/`isOpen`/`dispose` surface so `App.ts`
 * is unchanged. The sim is not reactive, so `refresh()` bumps a version the
 * view derives its snapshot (`shopView`) from.
 */

import { mount, unmount, type Component } from 'svelte';

import { WORKERS, type WorkerKind } from '@sim/balance/mobs';
import { itemPrice } from '@sim/commands/buyItem';
import { kopdesUpgradeCost } from '@sim/commands/upgradeKopdes';
import type { Sim } from '@sim/index';
import { kopdesRange } from '@sim/kopdes';
import type { Command, DispatchResult, ItemId } from '@sim/types';

import type { IconName } from '../icons.ts';

import KopdesShopView from './KopdesShop.svelte';

export interface ShopHandlers {
  dispatch(command: Command): DispatchResult;
  close(): void;
}

export type ShopTab = 'buy' | 'sell';

const WORKER_ICON: Record<WorkerKind, IconName> = {
  sanitizer: 'shop-sanitation',
  plantDoctor: 'shop-trichoderma',
  security: 'police-warning',
};

const ITEM_ICON: Record<ItemId, IconName> = {
  bibit: 'shop-bibit',
  forestSapling: 'shop-sapling',
  fertilizer: 'shop-fertilizer',
  sanitationCrew: 'shop-sanitation',
  pheromoneTrap: 'shop-trap',
  metarhizium: 'shop-metarhizium',
  trichoderma: 'shop-trichoderma',
};

const BUNDLES: Record<ItemId, number[]> = {
  bibit: [144, 12],
  forestSapling: [144],
  fertilizer: [1, 5],
  sanitationCrew: [1],
  pheromoneTrap: [1, 3],
  metarhizium: [1],
  trichoderma: [1],
};

const ITEMS = Object.keys(BUNDLES) as ItemId[];

/** A button that issues a command: what it costs, and why it is greyed out, if it is. */
export interface Offer {
  command: Command;
  rejection: string | null;
}

export interface ShopView {
  tick: number;
  kopdes: { level: number; range: number; autoHarvest: boolean } | null;
  indexPct: number;
  rows: {
    item: ItemId;
    icon: IconName;
    unit: number;
    stock: number;
    bundles: (Offer & { quantity: number; total: number })[];
  }[];
  workers: (Offer & {
    kind: WorkerKind;
    icon: IconName;
    hired: boolean;
    wagePerDay: number;
    hireFee: number;
  })[];
  autoHarvest: Offer & { on: boolean };
  price: number;
  trend: '▲' | '▼' | '▬';
  soldKgTotal: number;
  sales: { tick: number; note: string; amount: number }[];
  upgrade: Offer & { cost: number | null; from: number; to: number; range: number };
}

/** A plain snapshot of everything the shop shows, taken from the sim. */
export function shopView(sim: Sim): ShopView {
  const { state } = sim;
  const kopdes = state.kopdes;
  const index = state.economy.inputPriceIndex;
  const offer = (command: Command): Offer => ({
    command,
    rejection: sim.validate(command)?.reason ?? null,
  });

  const e = state.economy;
  const history = e.tbsPriceHistory;
  const earlier = history[Math.max(0, history.length - 11)] ?? e.tbsPrice;
  const level = kopdes?.level ?? 0;
  const upgradeCost = kopdes ? kopdesUpgradeCost(level) : null;

  return {
    tick: state.tick,
    kopdes: kopdes ? { level, range: kopdesRange(level), autoHarvest: kopdes.autoHarvest } : null,
    indexPct: Math.round(index * 100),
    rows: ITEMS.map((item) => {
      const unit = itemPrice(item, index);
      return {
        item,
        icon: ITEM_ICON[item],
        unit,
        stock: state.inventory[item],
        bundles: BUNDLES[item].map((quantity) => ({
          quantity,
          total: unit * quantity,
          ...offer({ type: 'BuyItem', item, quantity }),
        })),
      };
    }),
    workers: (Object.keys(WORKERS) as WorkerKind[]).map((kind) => {
      const spec = WORKERS[kind];
      const hired = state.mobs.some((m) => m.hired && m.species === kind);
      return {
        kind,
        icon: WORKER_ICON[kind],
        hired,
        wagePerDay: spec.wagePerDay,
        hireFee: spec.hireFee,
        ...offer(hired ? { type: 'DismissWorker', kind } : { type: 'HireWorker', kind }),
      };
    }),
    autoHarvest: {
      on: kopdes?.autoHarvest ?? false,
      ...offer({ type: 'SetAutoHarvest', on: !(kopdes?.autoHarvest ?? false) }),
    },
    price: e.tbsPrice,
    trend: e.tbsPrice > earlier * 1.01 ? '▲' : e.tbsPrice < earlier * 0.99 ? '▼' : '▬',
    soldKgTotal: e.soldKgTotal,
    sales: e.ledger
      .filter((entry) => entry.kind === 'sale')
      .slice(-5)
      .reverse()
      .map((sale) => ({ tick: sale.tick, note: sale.note ?? '', amount: sale.amount })),
    upgrade: {
      cost: upgradeCost,
      from: level,
      to: level + 1,
      range: kopdesRange(level + 1),
      ...offer({ type: 'UpgradeKopdes' }),
    },
  };
}

export class KopdesShop {
  readonly ui = $state<{ tab: ShopTab; version: number }>({ tab: 'buy', version: 0 });
  sim = $state.raw<Sim | null>(null);
  private readonly target: HTMLElement;
  private readonly instance: ReturnType<Component>;

  constructor(
    parent: HTMLElement,
    readonly handlers: ShopHandlers,
  ) {
    this.target = document.createElement('div');
    parent.appendChild(this.target);
    this.instance = mount(KopdesShopView, { target: this.target, props: { shop: this } });
  }

  get isOpen(): boolean {
    return this.sim !== null;
  }

  open(sim: Sim, tab: ShopTab = 'buy'): void {
    this.sim = sim;
    this.ui.tab = tab;
    this.ui.version++;
  }

  close(): void {
    this.sim = null;
  }

  toggle(sim: Sim): void {
    if (this.isOpen) this.handlers.close();
    else this.open(sim);
  }

  refresh(): void {
    if (!this.sim) return;
    this.ui.version++;
  }

  /** Dispatch from a button, then show the sim's new answer. */
  act(command: Command): void {
    this.handlers.dispatch(command);
    this.refresh();
  }

  dispose(): void {
    unmount(this.instance);
    this.target.remove();
  }
}
