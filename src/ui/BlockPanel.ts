/**
 * The block panel (§8 panel 9): what the selected block is, and what you can
 * do with it. Invalid actions stay visible with the sim's own rejection
 * reason, so the player learns the rules by reading, not by guessing.
 *
 * Planted blocks get a pest section with a clickable 12×12 slot grid — the
 * per-palm panel of §8 #10 without needing per-palm 3D picking.
 */

import { html, nothing, render, type TemplateResult } from 'lit-html';

import { BIOMES } from '@sim/balance/biomes';
import { COVER_CROP } from '@sim/balance/events';
import { FIRE } from '@sim/balance/fire';
import { GROWTH } from '@sim/balance/growth';
import { PEST_LABOUR, PLAGUE } from '@sim/balance/pests';
import { DRAINAGE_COST, IRRIGATION_COST, KOPDES_BUILD_COST } from '@sim/balance/prices';
import { isWetSeason } from '@sim/balance/seasons';
import { landPrice } from '@sim/commands/buyBlock';
import { itemPrice } from '@sim/commands/buyItem';
import { chopCost } from '@sim/commands/chopBlock';
import { seedlingItem, seedlingsNeeded } from '@sim/commands/plantBlock';
import { kopdesUpgradeCost } from '@sim/commands/upgradeKopdes';
import { isFuel, isWildfire } from '@sim/fire';
import type { Sim } from '@sim/index';
import { distanceToKopdes, inKopdesRange, kopdesRange } from '@sim/kopdes';
import { coverCropEstablished, forestCoverAround, landslideChance } from '@sim/landscape';
import { slotCol, slotRow, slotStage } from '@sim/palms';
import { neighbourIds, readBlock } from '@sim/state';
import { daysUntilRipe, harvestableKg } from '@sim/systems/harvest';
import { beetleCapacity, ganodermaCounts, pestPressure } from '@sim/systems/pest';
import type {
  Biome,
  BlockId,
  Command,
  DispatchResult,
  FireIntensity,
  GrowthStage,
} from '@sim/types';

import { formatKg, formatPercent, formatRp } from './format.ts';
import { icon, type IconName } from './icons.ts';

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

/** Which icon heads the panel: what is on the block, or what it is. */
function blockIcon(biome: Biome, phase: string): IconName {
  if (phase === 'kopdes') return 'kopdes';
  if (phase === 'planted' || phase === 'reforesting') return 'biome-palm-planted';
  if (phase === 'cleared' || phase === 'clearing') return 'biome-forest-cleared';
  switch (biome) {
    case 'forest':
    case 'protected':
    case 'rubber':
      return 'biome-forest-wild';
    case 'scrub':
      return 'biome-scrub';
    case 'hills':
      return 'biome-hills';
    case 'river':
    case 'riverbank':
    case 'swamp':
      return 'biome-river';
    default:
      return 'biome-grassfield';
  }
}

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
  private slot: number | null = null;

  constructor(
    parent: HTMLElement,
    private readonly handlers: BlockPanelHandlers,
  ) {
    this.root = document.createElement('div');
    this.root.className =
      'absolute top-20 right-3 z-10 max-h-[calc(100vh-6rem)] w-80 max-w-[calc(100vw-1.5rem)] overflow-y-auto';
    parent.appendChild(this.root);
  }

  get selected(): BlockId | null {
    return this.block;
  }

  show(sim: Sim, block: BlockId | null): void {
    this.sim = sim;
    if (block !== this.block) this.slot = null;
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
            cost: chopCost(block.biome, state),
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
        if (block.slope && (block.phase === 'planted' || block.phase === 'cleared')) {
          actions.push({
            label: block.coverCropUntil > state.tick ? 'Cover crop ✓' : 'Cover crop',
            command: { type: 'CoverCropBlock', block: id },
            cost: COVER_CROP.cost,
            testId: 'action-CoverCropBlock',
            minor: true,
          });
        }
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
      <div class="card p-4 text-sm" data-testid="block-panel">
        <div class="mb-3 flex items-start justify-between gap-2">
          <div class="flex items-center gap-2.5">
            <span class="pill flex h-10 w-10 items-center justify-center">
              ${icon(blockIcon(block.biome, block.phase), 'icon-lg')}
            </span>
            <div>
              <div class="label">Block ${x}, ${y}</div>
              <div class="text-base font-extrabold leading-tight">
                ${block.phase === 'kopdes' ? 'Kopdes' : BIOME_LABEL[block.biome]}
              </div>
              <div class="label" data-testid="block-phase">
                ${phaseLabel(block.phase, block.clearProgress, block.burning, block.fireIntensity)}
              </div>
            </div>
          </div>
          <button class="btn btn-close" aria-label="Close" @click=${() => this.handlers.close()}>
            ✕
          </button>
        </div>

        <dl class="pill mb-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
          <dt class="label">Title</dt>
          <dd>${block.owned ? 'Yours' : block.forSale ? 'For sale' : 'Not for sale'}</dd>
          <dt class="label">Elevation</dt>
          <dd>${block.elevation}${block.slope ? ' · slope' : ''}</dd>
          ${
            block.slope
              ? html`<dt class="label">Slope</dt>
                  <dd data-testid="block-slope">${slopeLine(sim, id)}</dd>`
              : nothing
          }
          <dt class="label">Moisture</dt>
          <dd>
            ${formatPercent(block.moisture)}${block.irrigated ? ' · irrigated' : ''}${block.drained ? ' · drained' : ''}
          </dd>
          ${
            block.debris > 0
              ? html`<dt class="label">Debris</dt>
                  <dd data-testid="block-debris">${Math.round(block.debris)} / 100</dd>`
              : nothing
          }
          ${
            block.ashUntil > state.tick
              ? html`<dt class="label">Ash</dt>
                  <dd>fertile for ${block.ashUntil - state.tick} more days</dd>`
              : nothing
          }
          ${
            block.phase === 'wild'
              ? html`<dt class="label">Plantable</dt>
                  <dd>${spec.plantableSlots} / 144 slots</dd>`
              : nothing
          }
          ${
            block.fertilizedUntil > state.tick
              ? html`<dt class="label">Fertilized</dt>
                  <dd>${block.fertilizedUntil - state.tick} days left</dd>`
              : nothing
          }
          ${
            block.owned && block.phase !== 'kopdes' && state.kopdes
              ? html`<dt class="label">Kopdes</dt>
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
        ${block.owned && (state.palms.has(id) || block.debris > 0 || block.beetles > 0) ? this.pestSection(sim, id) : nothing}

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
    const base = action.minor ? 'btn btn-sm' : 'btn w-full';
    return html`
      <div>
        <button
          class=${action.minor ? `${base} btn-ghost` : `${base} btn-green`}
          ?disabled=${rejection !== null}
          title=${rejection?.reason ?? ''}
          data-testid=${action.testId}
          @click=${() => this.act(action.command)}
        >
          <span class="flex w-full items-center justify-between gap-2">
            <span>${action.label}</span>
            ${action.cost !== undefined ? html`<span class="num rounded-lg bg-black/15 px-1.5 py-0.5 text-xs">${formatRp(action.cost)}</span>` : nothing}
          </span>
        </button>
        ${rejection && !action.minor ? html`<div class="mt-0.5 px-1 text-xs font-bold text-[#b85e12]">${rejection.reason}</div>` : nothing}
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
        class="rounded-2xl border-2 border-[#ffd6a1] bg-[#ffeed6] p-2.5"
        data-testid="burn-section"
        @mouseenter=${() => this.handlers.hoverBurn(fuel)}
        @mouseleave=${() => this.handlers.hoverBurn(null)}
      >
        <div class="mb-1.5 flex items-baseline justify-between text-xs">
          <span class="flex items-center gap-1.5 font-extrabold">${icon('fire')} Burn</span>
          <span class="muted num"
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
                class=${`btn btn-sm flex-1 flex-col gap-0 ${tips ? 'btn-red' : 'btn-orange'}`}
                ?disabled=${rejection !== null}
                title=${rejection?.reason ?? (tips ? 'This would tip the fire pressure over the line.' : '')}
                data-testid=${`action-BurnBlock-${intensity}`}
                @click=${() => this.act(command)}
              >
                ${INTENSITY_LABEL[intensity]}
                <span class="block text-[0.68rem] font-bold opacity-90"
                  >${FIRE.burnDays[intensity]} d · +${FIRE.pressure[intensity]}</span
                >
              </button>
            `;
          })}
        </div>
        <div class="muted mt-1.5 text-xs" data-testid="burn-preview">
          ${
            fuel.length === 0
              ? 'Nothing next door will catch.'
              : `Could spread to ${fuel.length} neighbour${fuel.length === 1 ? '' : 's'}${state.weather.regime === 'elNino' ? ' — doubled this El Niño year' : ''}.`
          }
          ${wildfire ? html`<span class="text-[#9e2e20]"> A wildfire is burning: any new fire joins it.</span>` : nothing}
        </div>
      </div>
    `;
  }

  private kopdesSection(sim: Sim) {
    const kopdes = sim.state.kopdes!;
    return html`
      <div class="pill mb-3 text-xs">
        <div class="flex items-baseline justify-between">
          <span class="font-extrabold">Level ${kopdes.level}</span>
          <span class="muted">sells within ${kopdesRange(kopdes.level)} blocks</span>
        </div>
        <button
          class="btn btn-ghost mt-2 w-full justify-between"
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
      <div class="pill mb-3 text-xs">
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

  /** Beetles, Ganoderma, treatments, the slot grid and per-palm actions (§3.4). */
  private pestSection(sim: Sim, id: BlockId) {
    const { state } = sim;
    const block = state.blocks.get(id)!;
    const palms = state.palms.get(id);
    const tick = state.tick;
    const capacity = beetleCapacity(block.debris);
    const pressure = pestPressure(block, palms);
    const counts = palms ? ganodermaCounts(palms) : null;

    const treatments: Action[] = [
      {
        label: 'Set traps',
        command: { type: 'SetTrap', block: id },
        testId: 'action-SetTrap',
        minor: true,
      },
      {
        label: 'Metarhizium',
        command: { type: 'ApplyMetarhizium', block: id },
        testId: 'action-ApplyMetarhizium',
        minor: true,
      },
    ];
    if (palms) {
      treatments.push({
        label: 'Trichoderma',
        command: { type: 'ApplyTrichoderma', block: id },
        testId: 'action-ApplyTrichoderma',
        minor: true,
      });
      treatments.push({
        label: 'Replant gaps',
        command: { type: 'ReplantBlock', block: id },
        testId: 'action-ReplantBlock',
        minor: true,
      });
    }

    const windows: string[] = [];
    if (block.trapsUntil > tick) windows.push(`traps ${block.trapsUntil - tick} d`);
    if (block.metarhiziumUntil > tick)
      windows.push(`Metarhizium ${block.metarhiziumUntil - tick} d`);
    if (block.trichodermaUntil > tick)
      windows.push(`Trichoderma ${block.trichodermaUntil - tick} d`);

    return html`
      <div
        class="mb-3 rounded-2xl border-2 border-[#ffc9bd] bg-[#ffece7] p-2.5 text-xs"
        data-testid="pest-section"
      >
        <div class="mb-1 flex items-baseline justify-between">
          <span class="flex items-center gap-1.5 font-extrabold">${icon('beetle')} Pests</span>
          ${
            block.plagued
              ? html`<span class="chip chip-pest" data-testid="plague-badge">PLAGUE</span>`
              : html`<span class="opacity-60"
                  >pressure ${pressure.toFixed(2)} / ${PLAGUE.onAt}</span
                >`
          }
        </div>
        <div class="flex flex-wrap gap-x-3">
          <span data-testid="pest-beetles"
            >beetles:
            ${Math.round(block.beetles)}${capacity > 0 ? ` / ${Math.round(capacity)} room` : ''}</span
          >
          ${
            counts
              ? html`<span data-testid="pest-ganoderma"
                  >Ganoderma: ${counts.symptomatic} sick · ${counts.dead} dead</span
                >`
              : nothing
          }
        </div>
        ${windows.length > 0 ? html`<div class="mt-0.5 opacity-70">${windows.join(' · ')}</div>` : nothing}
        ${
          block.debris > 0 && block.beetles > 5
            ? html`<div class="mt-0.5 text-amber-200/90">
                Debris is breeding beetles — sanitize it.
              </div>`
            : nothing
        }

        <div class="mt-2 flex flex-wrap gap-1.5">
          ${treatments.map((a) => this.actionButton(sim, a))}
        </div>

        ${palms ? this.slotGrid(sim, id) : nothing}
      </div>
    `;
  }

  private slotGrid(sim: Sim, id: BlockId) {
    const { state } = sim;
    const block = state.blocks.get(id)!;
    const palms = state.palms.get(id)!;
    const cells = [];
    for (let slot = 0; slot < palms.plantedAt.length; slot++) {
      const stage = slotStage(palms, slot, block.species, state.tick);
      const g = palms.ganoderma[slot]!;
      let cls = 'bg-[#efe1bf]';
      if (stage === 'dead') cls = 'bg-[#6f6f6f]';
      else if (g === 2) cls = 'bg-[#ffb03a]';
      else if (stage === 'mature' || stage === 'senile') cls = 'bg-[#3faa4c]';
      else if (stage === 'immature') cls = 'bg-[#7fb03a]';
      else if (stage === 'seedling') cls = 'bg-[#cbe08a]';
      const health = palms.health[slot]!;
      if (stage !== 'empty' && stage !== 'dead' && health < 128) cls += ' opacity-60';
      const ring = palms.trenched[slot] === 1 ? ' ring-2 ring-[#5a8bff]' : '';
      const selected = this.slot === slot ? ' outline outline-2 outline-[#4a3320]' : '';
      cells.push(html`
        <button
          class=${`h-3 w-3 rounded-[2px] ${cls}${ring}${selected}`}
          title=${`slot ${slotRow(slot)},${slotCol(slot)} · ${stage}${g === 2 ? ' · sick' : ''}`}
          data-testid=${`slot-cell-${slot}`}
          @click=${() => {
            this.slot = this.slot === slot ? null : slot;
            this.refresh();
          }}
        ></button>
      `);
    }

    const slot = this.slot;
    let detail: TemplateResult | typeof nothing = nothing;
    if (slot !== null && palms.plantedAt[slot]! >= 0) {
      const stage = slotStage(palms, slot, block.species, state.tick);
      const g = palms.ganoderma[slot]!;
      const remove: Action = {
        label: 'Remove palm',
        command: { type: 'RemovePalm', block: id, slot },
        cost: PEST_LABOUR.removePalm,
        testId: 'action-RemovePalm',
        minor: true,
      };
      const trench: Action = {
        label: 'Trench',
        command: { type: 'TrenchPalm', block: id, slot },
        cost: PEST_LABOUR.trenchPalm,
        testId: 'action-TrenchPalm',
        minor: true,
      };
      detail = html`
        <div class="pill mt-2" data-testid="slot-detail">
          <div class="flex justify-between">
            <span>Slot ${slotRow(slot)},${slotCol(slot)} · ${stage}</span>
            <span class="muted num">health ${Math.round((palms.health[slot]! / 255) * 100)}%</span>
          </div>
          ${g === 2 ? html`<div class="text-[#b85e12]">Ganoderma — visibly sick. Remove it before it spreads.</div>` : nothing}
          ${g === 3 ? html`<div class="text-[#b85e12]">Dead stump — still infectious until removed.</div>` : nothing}
          ${palms.trenched[slot] === 1 ? html`<div class="text-[#2f56b8]">Trenched: root links cut.</div>` : nothing}
          <div class="mt-1.5 flex flex-wrap gap-1.5">
            ${[remove, trench].map((a) => this.actionButton(sim, a))}
          </div>
        </div>
      `;
    } else if (slot !== null) {
      detail = html`<div class="pill muted mt-2" data-testid="slot-detail">
        Slot ${slotRow(slot)},${slotCol(slot)} is empty — Replant gaps fills it.
      </div>`;
    }

    return html`
      <div class="mt-2">
        <div class="label mb-1">Palms by slot — click one</div>
        <div class="grid grid-cols-12 gap-[2px]" data-testid="slot-grid">${cells}</div>
        ${detail}
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

/** Forest cover around a slope and what the next wet season risks there (§3.6.2). */
function slopeLine(sim: Sim, id: BlockId): string {
  const { state, world } = sim;
  const block = readBlock(state, world, id);
  const cover = Math.round(forestCoverAround(state, world, id) * 100);
  const crop = coverCropEstablished(block, state.tick)
    ? ' · cover crop holding'
    : block.coverCropUntil > state.tick
      ? ' · cover crop establishing'
      : '';
  // Risk over a wet season at an ordinary wet streak, so the number is stable to read.
  const probe = { ...state, weather: { ...state.weather, wetStreak: 3 } };
  const daily = landslideChance(probe, world, block, true);
  const season = 1 - Math.pow(1 - daily, 150);
  const risk = season > 0.3 ? 'high' : season > 0.1 ? 'moderate' : 'low';
  const now = isWetSeason(state.weather.dayOfYear) ? ' — wet season now' : '';
  return `${cover}% forest around · landslide risk ${risk} (${Math.round(season * 100)}%/wet season)${crop}${now}`;
}
