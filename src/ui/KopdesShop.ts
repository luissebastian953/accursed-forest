/**
 * The Kopdes shop (§8 panel 12): a Buy tab for inputs at `base × index`, a
 * Sell tab showing today's TBS price, the intake and recent sales, and the
 * building's upgrade. The range ring is drawn on the map while it is open.
 */

import { html, nothing, render } from 'lit-html';

import { itemPrice } from '@sim/commands/buyItem';
import { kopdesUpgradeCost } from '@sim/commands/upgradeKopdes';
import type { Sim } from '@sim/index';
import { kopdesRange } from '@sim/kopdes';
import type { Command, DispatchResult, ItemId } from '@sim/types';

import { formatDate, formatKg, formatRp } from './format.ts';

export interface ShopHandlers {
  dispatch(command: Command): DispatchResult;
  close(): void;
}

interface ShopRow {
  item: ItemId;
  label: string;
  note: string;
  bundles: number[];
}

const ROWS: ShopRow[] = [
  {
    item: 'bibit',
    label: 'Bibit',
    note: 'field-ready palm seedlings · 144 fill a block',
    bundles: [144, 12],
  },
  {
    item: 'forestSapling',
    label: 'Forest saplings',
    note: 'for reforesting a cleared block',
    bundles: [144],
  },
  {
    item: 'fertilizer',
    label: 'Fertilizer',
    note: 'one application lifts a block for 90 days',
    bundles: [1, 5],
  },
  {
    item: 'sanitationCrew',
    label: 'Sanitation crew',
    note: 'clears 60 debris from one block — the only real fix for beetles',
    bundles: [1],
  },
  {
    item: 'pheromoneTrap',
    label: 'Pheromone trap kit',
    note: 'kills beetles on one block for 120 days',
    bundles: [1, 3],
  },
  {
    item: 'metarhizium',
    label: 'Metarhizium',
    note: 'a fungus that slows beetle breeding for 90 days',
    bundles: [1],
  },
  {
    item: 'trichoderma',
    label: 'Trichoderma',
    note: 'halves Ganoderma spread on one block for 120 days',
    bundles: [1],
  },
];

type Tab = 'buy' | 'sell';

export class KopdesShop {
  private readonly root: HTMLElement;
  private sim: Sim | null = null;
  private tab: Tab = 'buy';

  constructor(
    parent: HTMLElement,
    private readonly handlers: ShopHandlers,
  ) {
    this.root = document.createElement('div');
    parent.appendChild(this.root);
  }

  get isOpen(): boolean {
    return this.sim !== null;
  }

  open(sim: Sim, tab: Tab = 'buy'): void {
    this.sim = sim;
    this.tab = tab;
    this.refresh();
  }

  close(): void {
    this.sim = null;
    render(nothing, this.root);
  }

  toggle(sim: Sim): void {
    if (this.isOpen) this.handlers.close();
    else this.open(sim);
  }

  refresh(): void {
    if (!this.sim) return;
    render(this.template(this.sim), this.root);
  }

  dispose(): void {
    this.root.remove();
  }

  private template(sim: Sim) {
    const { state } = sim;
    const kopdes = state.kopdes;
    return html`
      <div
        class="absolute top-20 left-3 z-10 w-[26rem] max-w-[calc(100vw-1.5rem)] rounded-xl bg-black/70 p-4 text-sm text-white shadow-lg backdrop-blur"
        data-testid="kopdes-shop"
      >
        <div class="mb-3 flex items-start justify-between gap-2">
          <div>
            <div class="text-xs uppercase tracking-wide opacity-60">Koperasi Desa</div>
            <div class="font-semibold">
              ${kopdes ? html`Kopdes · level ${kopdes.level} · range ${kopdesRange(kopdes.level)} blocks` : 'No Kopdes yet'}
            </div>
          </div>
          <button
            class="rounded px-2 py-0.5 hover:bg-white/15"
            aria-label="Close"
            @click=${() => this.handlers.close()}
          >
            ✕
          </button>
        </div>

        ${
          kopdes
            ? html`
                <div class="mb-3 flex gap-1 rounded bg-white/5 p-1 text-xs">
                  ${(['buy', 'sell'] as Tab[]).map(
                    (tab) => html`
                      <button
                        class=${this.tab === tab ? 'flex-1 rounded bg-white/15 px-2 py-1 font-medium' : 'flex-1 rounded px-2 py-1 opacity-70 hover:bg-white/10'}
                        data-testid=${`shop-tab-${tab}`}
                        @click=${() => {
                          this.tab = tab;
                          this.refresh();
                        }}
                      >
                        ${tab === 'buy' ? 'Buy' : 'Sell & upgrade'}
                      </button>
                    `,
                  )}
                </div>
                ${this.tab === 'buy' ? this.buyTab(sim) : this.sellTab(sim)}
              `
            : html`<div class="text-xs opacity-70">
                Place the Kopdes on a cleared block to open the shop.
              </div>`
        }
      </div>
    `;
  }

  private buyTab(sim: Sim) {
    const { state } = sim;
    const index = state.economy.inputPriceIndex;
    return html`
      <div class="flex flex-col gap-3">
        ${
          index !== 1
            ? html`<div class="text-xs text-amber-200/90">
                Input prices at ${Math.round(index * 100)}% of baseline.
              </div>`
            : nothing
        }
        ${ROWS.map((row) => {
          const unit = itemPrice(row.item, index);
          return html`
            <div class="rounded bg-white/5 p-2">
              <div class="flex items-baseline justify-between gap-2">
                <div>
                  <div class="font-medium">${row.label}</div>
                  <div class="text-xs opacity-60">${row.note}</div>
                </div>
                <div class="text-right text-xs">
                  <div class="tabular-nums">${formatRp(unit)} each</div>
                  <div class="opacity-60">
                    in stock:
                    <span data-testid=${`stock-${row.item}`}>${state.inventory[row.item]}</span>
                  </div>
                </div>
              </div>
              <div class="mt-2 flex gap-1.5">
                ${row.bundles.map((quantity) => {
                  const command: Command = { type: 'BuyItem', item: row.item, quantity };
                  const rejection = sim.validate(command);
                  return html`
                    <button
                      class=${
                        rejection
                          ? 'flex-1 cursor-not-allowed rounded bg-white/10 px-2 py-1.5 text-xs opacity-60'
                          : 'flex-1 rounded bg-emerald-600 px-2 py-1.5 text-xs font-medium hover:bg-emerald-500'
                      }
                      ?disabled=${rejection !== null}
                      title=${rejection?.reason ?? ''}
                      data-testid=${`buy-${row.item}-${quantity}`}
                      @click=${() => {
                        this.handlers.dispatch(command);
                        this.refresh();
                      }}
                    >
                      Buy ${quantity} · ${formatRp(unit * quantity)}
                    </button>
                  `;
                })}
              </div>
            </div>
          `;
        })}
      </div>
    `;
  }

  private sellTab(sim: Sim) {
    const { state } = sim;
    const e = state.economy;
    const history = e.tbsPriceHistory;
    const earlier = history[Math.max(0, history.length - 11)] ?? e.tbsPrice;
    const trend = e.tbsPrice > earlier * 1.01 ? '▲' : e.tbsPrice < earlier * 0.99 ? '▼' : '▬';
    const sales = e.ledger
      .filter((entry) => entry.kind === 'sale')
      .slice(-5)
      .reverse();

    const kopdes = state.kopdes!;
    const upgrade: Command = { type: 'UpgradeKopdes' };
    const upgradeRejection = sim.validate(upgrade);
    const upgradeCost = kopdesUpgradeCost(kopdes.level);

    return html`
      <div class="flex flex-col gap-3">
        <div class="rounded bg-white/5 p-2">
          <div class="flex items-baseline justify-between">
            <div class="font-medium">TBS today</div>
            <div class="tabular-nums" data-testid="shop-price">
              ${formatRp(e.tbsPrice)}/kg <span class="opacity-70">${trend}</span>
            </div>
          </div>
          <div class="mt-1 text-xs opacity-70">
            Harvested fruit inside range sells the same day at this price. Lifetime sold:
            ${formatKg(e.soldKgTotal)}.
          </div>
        </div>

        <div class="rounded bg-white/5 p-2">
          <div class="mb-1 font-medium">Recent sales</div>
          ${
            sales.length === 0
              ? html`<div class="text-xs opacity-60">Nothing sold yet.</div>`
              : html`
                  <ul class="text-xs">
                    ${sales.map(
                      (sale) => html`
                        <li class="flex justify-between gap-2 py-0.5">
                          <span class="opacity-70">${formatDate(sale.tick)}</span>
                          <span class="opacity-70">${sale.note ?? ''}</span>
                          <span class="tabular-nums">${formatRp(sale.amount)}</span>
                        </li>
                      `,
                    )}
                  </ul>
                `
          }
        </div>

        <div class="rounded bg-white/5 p-2">
          <div class="flex items-baseline justify-between">
            <div class="font-medium">Upgrade Kopdes</div>
            <div class="text-xs opacity-70">
              ${upgradeCost === null ? 'max level' : `level ${kopdes.level} → ${kopdes.level + 1}, range ${kopdesRange(kopdes.level + 1)}`}
            </div>
          </div>
          <button
            class=${
              upgradeRejection
                ? 'mt-2 w-full cursor-not-allowed rounded bg-white/10 px-3 py-1.5 text-left opacity-60'
                : 'mt-2 w-full rounded bg-emerald-600 px-3 py-1.5 text-left font-medium hover:bg-emerald-500'
            }
            ?disabled=${upgradeRejection !== null}
            data-testid="shop-upgrade"
            @click=${() => {
              this.handlers.dispatch(upgrade);
              this.refresh();
            }}
          >
            <span class="flex justify-between gap-2">
              <span>Upgrade</span>
              ${upgradeCost !== null ? html`<span class="tabular-nums opacity-80">${formatRp(upgradeCost)}</span>` : nothing}
            </span>
          </button>
          ${upgradeRejection ? html`<div class="mt-0.5 px-1 text-xs text-amber-200/90">${upgradeRejection.reason}</div>` : nothing}
        </div>
      </div>
    `;
  }
}
