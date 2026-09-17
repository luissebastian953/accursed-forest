/**
 * The Kopdes shop (§8 panel 12): a Buy tab for inputs at `base × index`, a
 * Sell tab showing today's TBS price, the intake and recent sales, and the
 * building's upgrade. The range ring is drawn on the map while it is open.
 */

import { html, nothing, render } from 'lit-html';

import { WORKERS, type WorkerKind } from '@sim/balance/mobs';
import { itemPrice } from '@sim/commands/buyItem';
import { kopdesUpgradeCost } from '@sim/commands/upgradeKopdes';
import type { Sim } from '@sim/index';
import { kopdesRange } from '@sim/kopdes';
import type { Command, DispatchResult, ItemId } from '@sim/types';

import { autoHarvestToggle } from './BlockPanel.ts';
import { formatDate, formatKg, formatRp } from './format.ts';
import { icon, type IconName } from './icons.ts';
import { phoneHeader, phoneShell } from './phone.ts';

export interface ShopHandlers {
  dispatch(command: Command): DispatchResult;
  close(): void;
}

const WORKER_ICON: Record<WorkerKind, IconName> = {
  sanitizer: 'shop-sanitation',
  plantDoctor: 'shop-trichoderma',
  security: 'police-warning',
};

const WORKER_BLURB: Record<WorkerKind, string> = {
  sanitizer: 'clears debris wherever it piles up',
  plantDoctor: 'removes sick palms, doses the block',
  security: 'keeps thieves off the ripe blocks',
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
    return phoneShell({
      testId: 'kopdes-shop',
      tick: state.tick,
      header: html`
        ${phoneHeader({
          tile: icon('kopdes', 'icon-lg'),
          title: kopdes ? 'Kopdes shop' : 'No Kopdes yet',
          subtitle: html`<div class="label">
            ${
              kopdes
                ? html`Koperasi Desa · level ${kopdes.level} · sells within
                  ${kopdesRange(kopdes.level)} blocks`
                : 'Koperasi Desa'
            }
          </div>`,
          closeTestId: 'shop-close',
          onClose: () => this.handlers.close(),
        })}
        ${
          kopdes
            ? html`<div class="border-b-2 border-[var(--card-edge)] px-[6%] pb-3">
                <div class="pill-muted flex gap-1 p-1 text-xs">
                  ${(['buy', 'sell'] as Tab[]).map(
                    (tab) => html`
                      <button
                        class=${`btn btn-sm flex-1 ${this.tab === tab ? (tab === 'buy' ? 'btn-coral' : 'btn-green') : 'btn-ghost'}`}
                        data-testid=${`shop-tab-${tab}`}
                        @click=${() => {
                          this.tab = tab;
                          this.refresh();
                        }}
                      >
                        ${tab === 'buy' ? 'BUY' : 'SELL & UPGRADE'}
                      </button>
                    `,
                  )}
                </div>
              </div>`
            : nothing
        }
      `,
      body: kopdes
        ? this.tab === 'buy'
          ? this.buyTab(sim)
          : this.sellTab(sim)
        : html`<div class="muted text-xs">
            Place the Kopdes on a cleared block to open the shop.
          </div>`,
    });
  }

  private buyTab(sim: Sim) {
    const { state } = sim;
    const index = state.economy.inputPriceIndex;
    return html`
      <div class="flex flex-col gap-3">
        ${
          index !== 1
            ? html`<div class="pill-muted text-xs font-bold text-[#b85e12]">
                Input prices at ${Math.round(index * 100)}% of baseline.
              </div>`
            : nothing
        }
        ${ROWS.map((row) => {
          const unit = itemPrice(row.item, index);
          return html`
            <div class="pill-muted p-2.5">
              <div class="flex items-baseline justify-between gap-2">
                <div class="flex items-start gap-2">
                  <span class="pill flex h-9 w-9 shrink-0 items-center justify-center"
                    >${icon(ITEM_ICON[row.item])}</span
                  >
                  <div>
                    <div class="font-extrabold">${row.label}</div>
                    <div class="muted text-xs">${row.note}</div>
                  </div>
                </div>
                <div class="shrink-0 text-right text-xs">
                  <div class="num">${formatRp(unit)} each</div>
                  <div class="muted">
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
                      class="btn btn-sm btn-green flex-1 flex-col gap-0"
                      ?disabled=${rejection !== null}
                      title=${rejection?.reason ?? ''}
                      data-testid=${`buy-${row.item}-${quantity}`}
                      @click=${() => {
                        this.handlers.dispatch(command);
                        this.refresh();
                      }}
                    >
                      <span>Buy ${quantity}</span>
                      <span class="num text-[0.68rem] opacity-90"
                        >${formatRp(unit * quantity)}</span
                      >
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

  /** People on the payroll (§mobs): a fee to hire, a wage a day, and they find their own work. */
  private workersSection(sim: Sim) {
    const { state } = sim;
    const kinds = Object.keys(WORKERS) as WorkerKind[];
    return html`
      <div class="pill-muted p-2.5" data-testid="shop-workers">
        <div class="mb-1 flex items-baseline justify-between">
          <div class="font-extrabold">Workers</div>
          <div class="muted text-xs">paid daily, find their own jobs</div>
        </div>
        <div class="flex flex-col gap-1.5">
          ${kinds.map((kind) => {
            const spec = WORKERS[kind];
            const hired = state.mobs.some((m) => m.hired && m.species === kind);
            const command: Command = hired
              ? { type: 'DismissWorker', kind }
              : { type: 'HireWorker', kind };
            const rejection = sim.validate(command);
            return html`
              <div class="flex items-center justify-between gap-2">
                <div class="flex items-center gap-2">
                  <span class="pill flex h-8 w-8 items-center justify-center"
                    >${icon(WORKER_ICON[kind])}</span
                  >
                  <div>
                    <div class="text-sm font-extrabold">${spec.label}</div>
                    <div class="muted text-xs">
                      ${WORKER_BLURB[kind]} · ${formatRp(spec.wagePerDay)}/day
                    </div>
                  </div>
                </div>
                <button
                  class=${`btn btn-sm shrink-0 ${hired ? 'btn-coral' : 'btn-green'}`}
                  ?disabled=${rejection !== null}
                  title=${rejection?.reason ?? ''}
                  data-testid=${`worker-${kind}`}
                  @click=${() => {
                    this.handlers.dispatch(command);
                    this.refresh();
                  }}
                >
                  ${hired ? 'Dismiss' : html`Hire · ${formatRp(spec.hireFee)}`}
                </button>
              </div>
            `;
          })}
        </div>
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
        ${this.workersSection(sim)}
        <div class="pill-muted p-2.5">
          <div class="flex items-baseline justify-between">
            <div class="font-extrabold">Picking</div>
            <div class="muted text-xs">
              ${kopdes.autoHarvest ? 'the Kopdes crew does the rounds' : 'you pick, block by block'}
            </div>
          </div>
          ${autoHarvestToggle(sim, (command) => {
            this.handlers.dispatch(command);
            this.refresh();
          })}
        </div>
        <div class="pill-muted p-2.5">
          <div class="flex items-baseline justify-between">
            <div class="font-extrabold">TBS today</div>
            <div class="num" data-testid="shop-price">
              ${formatRp(e.tbsPrice)}/kg <span class="muted">${trend}</span>
            </div>
          </div>
          <div class="muted mt-1 text-xs">
            Harvested fruit inside range sells the same day at this price. Lifetime sold:
            ${formatKg(e.soldKgTotal)}.
          </div>
        </div>

        <div class="pill-muted p-2.5">
          <div class="mb-1 font-extrabold">Recent sales</div>
          ${
            sales.length === 0
              ? html`<div class="muted text-xs">Nothing sold yet.</div>`
              : html`
                  <ul class="text-xs">
                    ${sales.map(
                      (sale) => html`
                        <li class="flex justify-between gap-2 py-0.5">
                          <span class="muted">${formatDate(sale.tick)}</span>
                          <span class="muted">${sale.note ?? ''}</span>
                          <span class="num">${formatRp(sale.amount)}</span>
                        </li>
                      `,
                    )}
                  </ul>
                `
          }
        </div>

        <div class="pill-muted p-2.5">
          <div class="flex items-baseline justify-between">
            <div class="font-extrabold">Upgrade Kopdes</div>
            <div class="muted text-xs">
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
            <span class="flex w-full items-center justify-between gap-2">
              <span>Upgrade</span>
              ${upgradeCost !== null ? html`<span class="num rounded-lg bg-black/15 px-1.5 py-0.5 text-xs">${formatRp(upgradeCost)}</span>` : nothing}
            </span>
          </button>
          ${upgradeRejection ? html`<div class="mt-0.5 px-1 text-xs font-bold text-[#b85e12]">${upgradeRejection.reason}</div>` : nothing}
        </div>
      </div>
    `;
  }
}
