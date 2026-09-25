import { BIOMES } from '@sim/balance/biomes';
import { seedlingsNeeded } from '@sim/commands/plantBlock';
import type { Sim } from '@sim/index';
import { readBlock } from '@sim/state';
import type { BlockId } from '@sim/types';

export type StepId =
  | 'placeKopdes'
  | 'placeWorkshop'
  | 'chop'
  | 'clearing'
  | 'buySeedlings'
  | 'plantPalms'
  | 'standCard'
  | 'palmSlots'
  | 'harvest'
  | 'autoHarvest'
  | 'visitKopdes'
  | 'openShop'
  | 'shopSeedlings'
  | 'shopFertilizer'
  | 'shopSanitation'
  | 'shopTrichoderma'
  | 'shopTrap';

/** What the walkthrough can see of the estate and the interface at one moment. */
export interface Probe {
  sim: Sim;
  /** The block the walkthrough chose for the chop, once it has chosen one. */
  field: BlockId | null;
  selected: BlockId | null;
  shopOpen: boolean;
}

/** What the walkthrough does to the interface when a step opens. */
export type StepEntry = 'selectKopdes' | 'selectField' | 'deselect' | 'openShop';

export interface Step {
  id: StepId;
  /** The map block the step points at, if any. */
  block: 'kopdes' | 'field' | null;
  /** The control the step points at, by test id, if any. */
  element: string | null;
  /** `pin`: the HUD pin carries the words, and the overlay draws only the ring. */
  card: 'own' | 'pin';
  /** A guide step: it waits for the Next button, not for the estate. */
  next: boolean;
  enter: StepEntry | null;
  /** The step is behind the player, so it is passed over. */
  done(probe: Probe): boolean;
}

function kopdesBlock(sim: Sim): BlockId {
  return sim.state.kopdes?.blockId ?? sim.state.worldGen.kopdesBlock;
}

function fieldPhase(probe: Probe): string | null {
  if (probe.field === null) return null;
  return readBlock(probe.sim.state, probe.sim.world, probe.field).phase;
}

/** Each estate step is read as "this far or further", so a player ahead of it is not sent back. */
const PLANTED = new Set(['planted', 'reforesting']);

const guide = (id: StepId, element: string, enter: StepEntry | null): Step => ({
  id,
  block: null,
  element,
  card: 'own',
  next: true,
  enter,
  done: () => false,
});

export const STEPS: readonly Step[] = [
  {
    id: 'placeKopdes',
    block: 'kopdes',
    element: null,
    card: 'pin',
    next: false,
    enter: null,
    done: (p) => p.sim.state.kopdes !== null || p.selected === kopdesBlock(p.sim),
  },
  {
    id: 'placeWorkshop',
    block: 'kopdes',
    element: 'action-PlaceKopdes',
    card: 'own',
    next: false,
    enter: 'selectKopdes',
    done: (p) => p.sim.state.kopdes !== null,
  },
  {
    id: 'chop',
    block: 'field',
    element: 'action-ChopBlock',
    card: 'own',
    next: false,
    enter: 'selectField',
    done: (p) => p.field === null || fieldPhase(p) !== 'wild',
  },
  {
    id: 'clearing',
    block: 'field',
    element: 'clearing-card',
    card: 'own',
    next: false,
    enter: 'selectField',
    done: (p) => {
      const phase = fieldPhase(p);

      return phase === null || (phase !== 'wild' && phase !== 'clearing');
    },
  },
  {
    id: 'buySeedlings',
    block: 'field',
    element: 'action-BuyBibit',
    card: 'own',
    next: false,
    enter: 'selectField',
    done: (p) => {
      if (p.field === null || PLANTED.has(fieldPhase(p) ?? '')) return true;

      const biome = readBlock(p.sim.state, p.sim.world, p.field).biome;

      return p.sim.state.inventory.bibit >= seedlingsNeeded(biome);
    },
  },
  {
    id: 'plantPalms',
    block: 'field',
    element: 'action-PlantBlock-palm',
    card: 'own',
    next: false,
    enter: 'selectField',
    done: (p) => p.field === null || PLANTED.has(fieldPhase(p) ?? ''),
  },
  guide('standCard', 'stand-card', 'selectField'),
  guide('palmSlots', 'slot-grid', 'selectField'),
  guide('harvest', 'action-HarvestBlock', 'selectField'),
  guide('autoHarvest', 'toggle-auto-harvest', 'selectField'),
  {
    id: 'visitKopdes',
    block: 'kopdes',
    element: null,
    card: 'pin',
    next: false,
    enter: 'deselect',
    done: (p) => p.selected === kopdesBlock(p.sim),
  },
  {
    id: 'openShop',
    block: null,
    element: 'action-OpenShop',
    card: 'own',
    next: false,
    enter: 'selectKopdes',
    done: (p) => p.shopOpen,
  },
  guide('shopSeedlings', 'shop-row-bibit', 'openShop'),
  guide('shopFertilizer', 'shop-row-fertilizer', 'openShop'),
  guide('shopSanitation', 'shop-row-sanitationCrew', 'openShop'),
  guide('shopTrichoderma', 'shop-row-trichoderma', 'openShop'),
  guide('shopTrap', 'shop-row-pheromoneTrap', 'openShop'),
];

/** The steps with the same eyebrow count as a run: `Guide, 2 of 4`, `Shop, 1 of 5`. */
export function runOf(step: Step): { n: number; of: number } | null {
  const group = STEPS.filter(
    (s) => s.next && s.id.startsWith('shop') === step.id.startsWith('shop'),
  );
  const n = group.indexOf(step);

  return step.next && n >= 0 ? { n: n + 1, of: group.length } : null;
}

/** The first step at or after `from` that is not already behind the player. */
export function firstUndone(from: number, probe: Probe): number {
  let i = from;

  while (i < STEPS.length && STEPS[i]!.done(probe)) i += 1;
  return i;
}

/** How far a block is from the Workshop, walking. */
function distance(sim: Sim, a: BlockId, b: BlockId): number {
  const [ax, ay] = sim.world.toXY(a);
  const [bx, by] = sim.world.toXY(b);

  return Math.abs(ax - bx) + Math.abs(ay - by);
}

/**
 * The block the walkthrough asks the player to chop: owned, wild, near the
 * Workshop, open land first. Null when the start site offers nothing.
 */
export function pickFieldBlock(sim: Sim): BlockId | null {
  const { state } = sim;
  const home = kopdesBlock(sim);
  let best: { id: BlockId; score: number } | null = null;

  for (const block of state.blocks.values()) {
    if (!block.owned || block.phase !== 'wild' || block.id === home) continue;

    const spec = BIOMES[block.biome];

    if (!spec.clearable || block.biome === 'river' || block.biome === 'protected') continue;

    const far = distance(sim, home, block.id);

    if (far > 3) continue;

    // Neighbours first, then the quickest chop, then the lowest id for a stable answer.
    const score = far * 1000 + (spec.openLand ? 0 : 500) + spec.chopDays;

    if (!best || score < best.score || (score === best.score && block.id < best.id)) {
      best = { id: block.id, score };
    }
  }

  return best?.id ?? null;
}
