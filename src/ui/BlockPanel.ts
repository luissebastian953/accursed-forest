/**
 * The block panel (§8 panel 9): what the selected block is, and what you can
 * do with it. Invalid actions stay visible with the sim's own rejection
 * reason, so the player learns the rules by reading, not by guessing.
 */

import { html, nothing, render } from 'lit-html';

import { BIOMES } from '@sim/balance/biomes';
import { GROWTH } from '@sim/balance/growth';
import { KOPDES_BUILD_COST } from '@sim/balance/prices';
import { landPrice } from '@sim/commands/buyBlock';
import { chopCost } from '@sim/commands/chopBlock';
import { plantingCost } from '@sim/commands/plantBlock';
import type { Sim } from '@sim/index';
import { slotStage } from '@sim/palms';
import { readBlock } from '@sim/state';
import type { Biome, BlockId, Command, DispatchResult, GrowthStage } from '@sim/types';

import { formatPercent, formatRp } from './format.ts';

export interface BlockPanelHandlers {
  dispatch(command: Command): DispatchResult;
  close(): void;
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

interface Action {
  label: string;
  command: Command;
  cost?: number;
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

    const actions: Action[] = [];
    if (!block.owned) {
      const buy: Action = { label: 'Buy land', command: { type: 'BuyBlock', block: id } };
      if (block.forSale) buy.cost = landPrice(state, world, id);
      actions.push(buy);
    } else {
      if (block.phase === 'wild')
        actions.push({
          label: 'Chop',
          command: { type: 'ChopBlock', block: id },
          cost: chopCost(block.biome),
        });
      if (block.phase === 'cleared' || block.phase === 'wild') {
        actions.push({
          label: 'Plant palms',
          command: { type: 'PlantBlock', block: id, species: 'palm' },
          cost: plantingCost(block.biome, 'palm', state.economy.inputPriceIndex),
        });
        actions.push({
          label: 'Plant forest',
          command: { type: 'PlantBlock', block: id, species: 'forest' },
          cost: plantingCost(block.biome, 'forest', state.economy.inputPriceIndex),
        });
      }
      if (block.phase === 'cleared' && !state.kopdes) {
        actions.push({
          label: 'Place Kopdes',
          command: { type: 'PlaceKopdes', block: id },
          cost: KOPDES_BUILD_COST,
        });
      }
    }

    const palms = state.palms.get(id);
    const stageCounts = new Map<GrowthStage, number>();
    let growthSum = 0;
    let growthN = 0;
    if (palms) {
      for (let slot = 0; slot < palms.plantedAt.length; slot++) {
        if (palms.plantedAt[slot]! < 0) continue;
        const stage = slotStage(palms, slot, block.species, state.tick);
        stageCounts.set(stage, (stageCounts.get(stage) ?? 0) + 1);
        growthSum += palms.growth[slot]!;
        growthN += 1;
      }
    }
    const meanGrowth = growthN > 0 ? growthSum / growthN : 0;
    const nextStage =
      meanGrowth < GROWTH.seedlingDays
        ? GROWTH.seedlingDays
        : meanGrowth < GROWTH.immatureDays
          ? GROWTH.immatureDays
          : null;

    return html`
      <div
        class="rounded-xl bg-black/65 p-4 text-sm text-white shadow-lg backdrop-blur"
        data-testid="block-panel"
      >
        <div class="mb-2 flex items-start justify-between gap-2">
          <div>
            <div class="text-xs uppercase tracking-wide opacity-60">Block ${x}, ${y}</div>
            <div class="font-semibold">${BIOME_LABEL[block.biome]}</div>
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
          <dd data-testid="block-phase">${phaseLabel(block.phase, block.clearProgress)}</dd>
          <dt class="opacity-60">Title</dt>
          <dd>${block.owned ? 'Yours' : block.forSale ? 'For sale' : 'Not for sale'}</dd>
          <dt class="opacity-60">Elevation</dt>
          <dd>${block.elevation}${block.slope ? ' · slope' : ''}</dd>
          <dt class="opacity-60">Moisture</dt>
          <dd>${formatPercent(block.moisture)}</dd>
          ${
            block.debris > 0
              ? html`<dt class="opacity-60">Debris</dt>
                  <dd>${Math.round(block.debris)} / 100</dd>`
              : nothing
          }
          ${
            block.phase === 'wild'
              ? html`<dt class="opacity-60">Plantable</dt>
                  <dd>${spec.plantableSlots} / 144 slots</dd>`
              : nothing
          }
        </dl>

        ${
          palms
            ? html`
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
                </div>
              `
            : nothing
        }

        <div class="flex flex-col gap-1.5">
          ${actions.map((action) => {
            const rejection = sim.validate(action.command);
            return html`
              <div>
                <button
                  class=${
                    rejection
                      ? 'w-full cursor-not-allowed rounded bg-white/10 px-3 py-1.5 text-left opacity-60'
                      : 'w-full rounded bg-emerald-600 px-3 py-1.5 text-left font-medium hover:bg-emerald-500'
                  }
                  ?disabled=${rejection !== null}
                  data-testid=${`action-${action.command.type}${'species' in action.command ? `-${action.command.species}` : ''}`}
                  @click=${() => this.act(action.command)}
                >
                  <span class="flex justify-between gap-2">
                    <span>${action.label}</span>
                    ${action.cost !== undefined ? html`<span class="tabular-nums opacity-80">${formatRp(action.cost)}</span>` : nothing}
                  </span>
                </button>
                ${rejection ? html`<div class="mt-0.5 px-1 text-xs text-amber-200/90">${rejection.reason}</div>` : nothing}
              </div>
            `;
          })}
        </div>
      </div>
    `;
  }

  private act(command: Command): void {
    this.handlers.dispatch(command);
    this.refresh();
  }
}

function phaseLabel(phase: string, progress: number): string {
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
