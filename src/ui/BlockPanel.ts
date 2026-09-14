/**
 * The block panel (§8 panel 9): what the selected block is, and what you can
 * do with it. Invalid actions stay visible with the sim's own rejection
 * reason, so the player learns the rules by reading, not by guessing.
 */

import { html, nothing, render } from 'lit-html';

import { BIOMES } from '@sim/balance/biomes';
import { FIRE } from '@sim/balance/fire';
import { GROWTH } from '@sim/balance/growth';
import { DRAINAGE_COST, IRRIGATION_COST, KOPDES_BUILD_COST } from '@sim/balance/prices';
import { landPrice } from '@sim/commands/buyBlock';
import { itemPrice } from '@sim/commands/buyItem';
import { chopCost } from '@sim/commands/chopBlock';
import { seedlingItem, seedlingsNeeded } from '@sim/commands/plantBlock';
import { kopdesUpgradeCost } from '@sim/commands/upgradeKopdes';
import { isFuel, isWildfire } from '@sim/fire';
import type { Sim } from '@sim/index';
import { distanceToKopdes, inKopdesRange, kopdesRange } from '@sim/kopdes';
import { slotStage } from '@sim/palms';
import { neighbourIds, readBlock } from '@sim/state';
import { daysUntilRipe, harvestableKg } from '@sim/systems/harvest';
import type {
  Biome,
  BlockId,
  Command,
  DispatchResult,
  FireIntensity,
  GrowthStage,
} from '@sim/types';

import { formatKg, formatPercent, formatRp } from './format.ts';

export interface BlockPanelHandlers {
  dispatch(command: Command): DispatchResult;
  close(): void;
  openShop(): void;
  /** Hovering a Burn button previews which neighbours could catch (§8 panel 22). */
  hoverBurn(blocks: BlockId[] | null): void;
}

const BIOME_LABEL: Record<Biome, string> = {
  grassfield: 'Grassfield (padang)',
  forest: 'Wild forest (hutan)',
  scrub: 'Dry scrub (lahan kering)',
  hills: 'Hills (perbukitan)',
  riverbank: 'Riverbank (bantaran)',
  river: 'River',
  protected: 'Protected forest (hutan lindung)',
  peat: 'Peatland (gambut)',
  rubber: 'Old rubber estate',
  village: 'Village land',
  swamp: 'Swamp (rawa)',
};

const STAGE_ORDER: GrowthStage[] = ['seedling', 'immature', 'mature', 'senile', 'dead'];
const INTENSITY_LABEL: Record<FireIntensity, string> = { 1: 'Low', 2: 'Medium', 3: 'High' };

interface Action {
  label: string;
  command: Command;
  cost?: number;
  testId: string;
  /** Secondary actions render smaller and grey. */
  minor?: boolean;
}

export class BlockPanel {
  private readonly root: HTMLElement;
  private sim: Sim | null = null;
  private block: BlockId | null = null;

  constructor(
    parent: HTMLElement,
    private readonly handlers: BlockPanelHandlers,
  ) {
    this.root = document.createElement('div');
    this.root.className = 'absolute top-20 right-3 z-10 w-80 max-w-[calc(100vw-1.5rem)]';
    parent.appendChild(this.root);
  }

  get selected(): BlockId | null {
    return this.block;
  }

  show(sim: Sim, block: BlockId | null): void {
    this.sim = sim;
    this.block = block;
    if (block === null) this.handlers.hoverBurn(null);
    this.refresh();
  }

  /** Re-render the current selection against current state. */
  refresh(): void {
    if (!this.sim || this.block === null) {
      render(nothing, this.root);
      return;
    }
    render(this.template(this.sim, this.block), this.root);
  }

  dispose(): void {
    this.root.remove();
  }

  private template(sim: Sim, id: BlockId) {
    const { state, world } = sim;
    const block = readBlock(state, world, id);
    const [x, y] = world.toXY(id);
    const spec = BIOMES[block.biome];
    const index = state.economy.inputPriceIndex;

    const actions: Action[] = [];
    let burnable = false;
    if (!block.owned) {
      const buy: Action = {
        label: 'Buy land',
        command: { type: 'BuyBlock', block: id },
        testId: 'action-BuyBlock',
      };
      if (block.forSale) buy.cost = landPrice(state, world, id);
      actions.push(buy);
    } else if (!block.burning) {
      switch (block.phase) {
        case 'wild':
          actions.push({
            label: 'Chop',
            command: { type: 'ChopBlock', block: id },
            cost: chopCost(block.biome),
            testId: 'action-ChopBlock',
          });
          burnable = isFuel(block, false);
          break;
        case 'cleared': {
          const needed = seedlingsNeeded(block.biome);
          actions.push({
            label: `Plant palms (${needed} bibit)`,
            command: { type: 'PlantBlock', block: id, species: 'palm' },
            testId: 'action-PlantBlock-palm',
          });
          if (state.kopdes && state.inventory.bibit < needed) {
            const shortfall = needed - state.inventory.bibit;
            actions.push({
              label: `Buy ${shortfall} bibit`,
              command: { type: 'BuyItem', item: seedlingItem('palm'), quantity: shortfall },
              cost: itemPrice('bibit', index) * shortfall,
              testId: 'action-BuyBibit',
            });
          }
          actions.push({
            label: `Plant forest (${needed} saplings)`,
            command: { type: 'PlantBlock', block: id, species: 'forest' },
            testId: 'action-PlantBlock-forest',
          });
          if (!state.kopdes) {
            actions.push({
              label: 'Place Kopdes',
              command: { type: 'PlaceKopdes', block: id },
              cost: KOPDES_BUILD_COST,
              testId: 'action-PlaceKopdes',
            });
          }
          burnable = isFuel(block, false);
          break;
        }
        case 'planted':
          if (block.species === 'palm') {
            actions.push({
              label: 'Harvest',
              command: { type: 'HarvestBlock', block: id },
              testId: 'action-HarvestBlock',
            });
          }
          actions.push({
            label: 'Fertilize (90 days)',
            command: { type: 'FertilizeBlock', block: id },
            testId: 'action-FertilizeBlock',
          });
          break;
        case 'reforesting':
          actions.push({
            label: 'Fertilize (90 days)',
            command: { type: 'FertilizeBlock', block: id },
            testId: 'action-FertilizeBlock',
          });
          break;
        case 'kopdes': {
          const cost = kopdesUpgradeCost(state.kopdes?.level ?? 1);
          const upgrade: Action = {
            label: 'Upgrade Kopdes',
            command: { type: 'UpgradeKopdes' },
            testId: 'action-UpgradeKopdes',
          };
          if (cost !== null) upgrade.cost = cost;
          actions.push(upgrade);
          break;
        }
        case 'clearing':
          break;
      }

      if (block.debris > 0) {
        actions.push({
          label: 'Sanitize (1 crew)',
          command: { type: 'SanitizeBlock', block: id },
          testId: 'action-SanitizeBlock',
          minor: true,
        });
      }
      if (block.phase !== 'kopdes' && block.biome !== 'river') {
        if (!block.irrigated) {
          actions.push({
            label: 'Irrigate',
            command: { type: 'IrrigateBlock', block: id },
            cost: IRRIGATION_COST,
            testId: 'action-IrrigateBlock',
            minor: true,
          });
        }
        if (!block.drained) {
          actions.push({
            label: 'Drain',
            command: { type: 'DrainBlock', block: id },
            cost: DRAINAGE_COST,
            testId: 'action-DrainBlock',
            minor: true,
          });
        }
      }
    }

    return html`
      <div
        class="rounded-xl bg-black/65 p-4 text-sm text-white shadow-lg backdrop-blur"
        data-testid="block-panel"
      >
        <div class="mb-2 flex items-start justify-between gap-2">
          <div>
            <div class="text-xs uppercase tracking-wide opacity-60">Block ${x}, ${y}</div>
            <div class="font-semibold">
              ${block.phase === 'kopdes' ? 'Kopdes' : BIOME_LABEL[block.biome]}
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

        <dl class="mb-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
          <dt class="opacity-60">Status</dt>
          <dd data-testid="block-phase">
            ${phaseLabel(block.phase, block.clearProgress, block.burning, block.fireIntensity)}
          </dd>
          <dt class="opacity-60">Title</dt>
          <dd>${block.owned ? 'Yours' : block.forSale ? 'For sale' : 'Not for sale'}</dd>
          <dt class="opacity-60">Elevation</dt>
          <dd>${block.elevation}${block.slope ? ' · slope' : ''}</dd>
          <dt class="opacity-60">Moisture</dt>
          <dd>
            ${formatPercent(block.moisture)}${block.irrigated ? ' · irrigated' : ''}${block.drained ? ' · drained' : ''}
          </dd>
          ${
            block.debris > 0
              ? html`<dt class="opacity-60">Debris</dt>
                  <dd data-testid="block-debris">${Math.round(block.debris)} / 100</dd>`
              : nothing
          }
          ${
            block.ashUntil > state.tick
              ? html`<dt class="opacity-60">Ash</dt>
                  <dd>fertile for ${block.ashUntil - state.tick} more days</dd>`
              : nothing
          }
          ${
            block.phase === 'wild'
              ? html`<dt class="opacity-60">Plantable</dt>
                  <dd>${spec.plantableSlots} / 144 slots</dd>`
              : nothing
          }
          ${
            block.fertilizedUntil > state.tick
              ? html`<dt class="opacity-60">Fertilized</dt>
                  <dd>${block.fertilizedUntil - state.tick} days left</dd>`
              : nothing
          }
          ${
            block.owned && block.phase !== 'kopdes' && state.kopdes
              ? html`<dt class="opacity-60">Kopdes</dt>
                  <dd data-testid="block-range">
                    ${
                      inKopdesRange(state, world, id)
                        ? `in range (${distanceToKopdes(state, world, id)} blocks)`
                        : `out of range (${distanceToKopdes(state, world, id)} of ${kopdesRange(state.kopdes.level)}) — TBS would spoil`
                    }
                  </dd>`
              : nothing
          }
        </dl>

        ${block.phase === 'kopdes' && state.kopdes ? this.kopdesSection(sim) : nothing}
        ${state.palms.has(id) ? this.palmsSection(sim, id) : nothing}

        <div class="flex flex-col gap-1.5">
          ${actions.filter((a) => !a.minor).map((action) => this.actionButton(sim, action))}
          ${burnable ? this.burnSection(sim, id) : nothing}
          ${
            actions.some((a) => a.minor)
              ? html`<div class="mt-1 flex flex-wrap gap-1.5">
                  ${actions.filter((a) => a.minor).map((action) => this.actionButton(sim, action))}
                </div>`
              : nothing
          }
        </div>
      </div>
    `;
  }

  private actionButton(sim: Sim, action: Action) {
    const rejection = sim.validate(action.command);
    const base = action.minor
      ? 'rounded px-2.5 py-1 text-left text-xs'
      : 'w-full rounded px-3 py-1.5 text-left';
    return html`
      <div class=${action.minor ? '' : ''}>
        <button
          class=${
            rejection
              ? `${base} cursor-not-allowed bg-white/10 opacity-60`
              : action.minor
                ? `${base} bg-white/15 font-medium hover:bg-white/25`
                : `${base} bg-emerald-600 font-medium hover:bg-emerald-500`
          }
          ?disabled=${rejection !== null}
          title=${rejection?.reason ?? ''}
          data-testid=${action.testId}
          @click=${() => this.act(action.command)}
        >
          <span class="flex justify-between gap-2">
            <span>${action.label}</span>
            ${action.cost !== undefined ? html`<span class="tabular-nums opacity-80">${formatRp(action.cost)}</span>` : nothing}
          </span>
        </button>
        ${rejection && !action.minor ? html`<div class="mt-0.5 px-1 text-xs text-amber-200/90">${rejection.reason}</div>` : nothing}
      </div>
    `;
  }

  /** Burn: three intensities, the spread preview on hover, the pressure it adds. */
  private burnSection(sim: Sim, id: BlockId) {
    const { state, world } = sim;
    const wildfire = isWildfire(state);
    const fuel = neighbourIds(world, id).filter((n) =>
      isFuel(readBlock(state, world, n), wildfire),
    );
    const threshold = FIRE.wildfireThreshold;
    const pressure = state.society.firePressure;

    return html`
      <div
        class="rounded bg-orange-950/40 p-2"
        data-testid="burn-section"
        @mouseenter=${() => this.handlers.hoverBurn(fuel)}
        @mouseleave=${() => this.handlers.hoverBurn(null)}
      >
        <div class="mb-1.5 flex items-baseline justify-between text-xs">
          <span class="font-medium">Burn</span>
          <span class="opacity-70"
            >${formatRp(FIRE.burnCost)} · pressure ${pressure.toFixed(1)} / ${threshold}</span
          >
        </div>
        <div class="flex gap-1.5">
          ${([1, 2, 3] as FireIntensity[]).map((intensity) => {
            const command: Command = { type: 'BurnBlock', block: id, intensity };
            const rejection = sim.validate(command);
            const tips = pressure + FIRE.pressure[intensity] > threshold;
            return html`
              <button
                class=${
                  rejection
                    ? 'flex-1 cursor-not-allowed rounded bg-white/10 px-2 py-1.5 text-xs opacity-60'
                    : tips
                      ? 'flex-1 rounded bg-red-700 px-2 py-1.5 text-xs font-medium hover:bg-red-600'
                      : 'flex-1 rounded bg-orange-700 px-2 py-1.5 text-xs font-medium hover:bg-orange-600'
                }
                ?disabled=${rejection !== null}
                title=${rejection?.reason ?? (tips ? 'This would tip the fire pressure over the line.' : '')}
                data-testid=${`action-BurnBlock-${intensity}`}
                @click=${() => this.act(command)}
              >
                ${INTENSITY_LABEL[intensity]}
                <span class="block opacity-80"
                  >${FIRE.burnDays[intensity]} d · +${FIRE.pressure[intensity]}</span
                >
              </button>
            `;
          })}
        </div>
        <div class="mt-1.5 text-xs opacity-70" data-testid="burn-preview">
          ${
            fuel.length === 0
              ? 'Nothing next door will catch.'
              : `Could spread to ${fuel.length} neighbour${fuel.length === 1 ? '' : 's'} — ${Math.round(FIRE.spreadPerDay[1] * 100)}–${Math.round(FIRE.spreadPerDay[3] * 100)}% per day by intensity${state.weather.regime === 'elNino' ? ', doubled this El Niño year' : ''}.`
          }
          ${wildfire ? html`<span class="text-red-300"> A wildfire is burning: any new fire joins it.</span>` : nothing}
        </div>
      </div>
    `;
  }

  private kopdesSection(sim: Sim) {
    const kopdes = sim.state.kopdes!;
    return html`
      <div class="mb-3 rounded bg-white/5 p-2 text-xs">
        <div class="flex items-baseline justify-between">
          <span class="font-medium">Level ${kopdes.level}</span>
          <span class="opacity-70">sells within ${kopdesRange(kopdes.level)} blocks</span>
        </div>
        <button
          class="mt-2 w-full rounded bg-white/10 px-3 py-1.5 text-left font-medium hover:bg-white/20"
          data-testid="action-OpenShop"
          @click=${() => this.handlers.openShop()}
        >
          Open shop
        </button>
      </div>
    `;
  }

  private palmsSection(sim: Sim, id: BlockId) {
    const { state } = sim;
    const block = state.blocks.get(id)!;
    const palms = state.palms.get(id)!;

    const stageCounts = new Map<GrowthStage, number>();
    let growthSum = 0;
    let growthN = 0;
    for (let slot = 0; slot < palms.plantedAt.length; slot++) {
      if (palms.plantedAt[slot]! < 0) continue;
      const stage = slotStage(palms, slot, block.species, state.tick);
      stageCounts.set(stage, (stageCounts.get(stage) ?? 0) + 1);
      growthSum += palms.growth[slot]!;
      growthN += 1;
    }
    const meanGrowth = growthN > 0 ? growthSum / growthN : 0;
    const nextStage =
      meanGrowth < GROWTH.seedlingDays
        ? GROWTH.seedlingDays
        : meanGrowth < GROWTH.immatureDays
          ? GROWTH.immatureDays
          : null;

    const bearing = (stageCounts.get('mature') ?? 0) + (stageCounts.get('senile') ?? 0);
    const kg = block.species === 'palm' ? harvestableKg(palms, 'palm', state.tick) : 0;
    const days = daysUntilRipe(block, state.tick);

    return html`
      <div class="mb-3 rounded bg-white/5 p-2 text-xs">
        <div class="mb-1 font-medium">
          ${block.species === 'forest' ? 'Forest' : 'Palms'} · ${growthN}
        </div>
        <div class="flex flex-wrap gap-x-3">
          ${STAGE_ORDER.filter((s) => stageCounts.has(s)).map((s) => html`<span>${s}: ${stageCounts.get(s)}</span>`)}
        </div>
        ${
          nextStage !== null
            ? html`<div class="mt-1 opacity-70" data-testid="growth-progress">
                ${Math.round(meanGrowth)} / ${nextStage} growth-days
              </div>`
            : nothing
        }
        ${
          bearing > 0
            ? html`
                <div class="mt-1 flex justify-between opacity-90" data-testid="harvest-info">
                  <span>On the trees: ${formatKg(kg)}</span>
                  <span
                    >${days === null ? '' : days === 0 ? 'ripe now' : `next round in ${days} d`}</span
                  >
                </div>
              `
            : nothing
        }
      </div>
    `;
  }

  private act(command: Command): void {
    this.handlers.dispatch(command);
    this.refresh();
  }
}

function phaseLabel(phase: string, progress: number, burning: boolean, intensity: number): string {
  if (burning)
    return `Burning · ${['', 'low', 'medium', 'high'][intensity] ?? ''} · ${Math.round(progress * 100)}%`;
  switch (phase) {
    case 'wild':
      return 'Wild';
    case 'clearing':
      return `Clearing · ${Math.round(progress * 100)}%`;
    case 'cleared':
      return 'Cleared';
    case 'planted':
      return 'Planted';
    case 'reforesting':
      return 'Reforesting';
    case 'kopdes':
      return 'Kopdes';
    default:
      return phase;
  }
}
