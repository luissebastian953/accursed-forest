/**
 * Mobs (POC → game): wild animals for the eye, a thief and a babi ngepet for
 * the ledger, ghosts for the abandoned corners, and the workers you pay.
 *
 * Runs after the economy and before society, so a theft shows up in the
 * day's books and the news. Every roll comes from its own stream, forked
 * from the seed and the tick: a crowd of boars must never shift the weather.
 *
 * Positions are in block units. A mob walks toward its target a few blocks a
 * day; the renderer interpolates and animates between ticks.
 */

import { clamp } from '@shared/math';

import {
  BABI_NGEPET,
  GHOST,
  MOB_STREAM,
  ROAM,
  THIEF,
  WILDLIFE,
  WORKERS,
  WORKER_JOBS,
  type WorkerKind,
} from '../balance/mobs.ts';
import { isBearing, slotStage } from '../palms.ts';
import { chance, forkRng, nextFloat, nextInt, pickWeighted, type RngState } from '../rng.ts';
import { readBlock, spend, writeBlock, type SimContext } from '../state.ts';
import type { Block, BlockId, Mob, MobSpecies, SimState } from '../types.ts';
import type { World } from '../worldgen/index.ts';

import { ganodermaCounts } from './pest.ts';

const WILD_KINDS = Object.keys(WILDLIFE.kinds) as (keyof typeof WILDLIFE.kinds)[];

export function mobs(ctx: SimContext): void {
  const { state } = ctx;
  const rng = forkRng(state.seed ^ MOB_STREAM, state.tick);

  payWages(ctx);
  spawnWildlife(ctx, rng);
  spawnVisitors(ctx, rng);
  spawnGhost(ctx, rng);
  spawnCrews(ctx);

  for (const mob of state.mobs) step(ctx, mob, rng);

  // Whoever has left, or run out of time, goes.
  const staying: Mob[] = [];
  for (const mob of state.mobs) {
    const gone = mob.intent === 'leave' && atTarget(mob);
    const expired = !mob.hired && state.tick >= mob.until && mob.intent !== 'work';
    if (gone || (expired && mob.species !== 'crew')) {
      ctx.events.push({ type: 'MobLeft', id: mob.id, species: mob.species });
    } else {
      staying.push(mob);
    }
  }
  state.mobs = staying;
}

// ── Helpers ───────────────────────────────────────────────────────────────

function atTarget(mob: Mob): boolean {
  return Math.hypot(mob.tx - mob.x, mob.tz - mob.z) < 0.15;
}

function centre(world: World, id: BlockId): [number, number] {
  const [x, y] = world.toXY(id);
  return [x + 0.5, y + 0.5];
}

/** Move toward the target at `speed` blocks a day. */
function walk(mob: Mob, speed: number): void {
  const dx = mob.tx - mob.x;
  const dz = mob.tz - mob.z;
  const d = Math.hypot(dx, dz);
  if (d <= speed) {
    mob.x = mob.tx;
    mob.z = mob.tz;
    return;
  }
  mob.x += (dx / d) * speed;
  mob.z += (dz / d) * speed;
}

function estateBounds(state: SimState, world: World) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const block of state.blocks.values()) {
    if (!block.owned) continue;
    const [x, y] = world.toXY(block.id);
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
  }
  return { minX, minY, maxX, maxY };
}

/** A random block around the estate that suits the species, or null. */
function roamTarget(
  ctx: SimContext,
  rng: RngState,
  biomes: readonly string[] | null,
  onPlanted = false,
): BlockId | null {
  const { state, world } = ctx;
  const b = estateBounds(state, world);
  if (b.minX === Infinity) return null;
  for (let attempt = 0; attempt < 8; attempt++) {
    const x = clamp(
      b.minX - ROAM + nextInt(rng, b.maxX - b.minX + ROAM * 2 + 1),
      0,
      world.width - 1,
    );
    const y = clamp(
      b.minY - ROAM + nextInt(rng, b.maxY - b.minY + ROAM * 2 + 1),
      0,
      world.height - 1,
    );
    const id = world.toId(x, y);
    const block = readBlock(state, world, id);
    if (block.biome === 'river') continue;
    if (onPlanted && block.phase === 'planted') return id;
    if (biomes === null || (block.phase === 'wild' && biomes.includes(block.biome))) return id;
  }
  return null;
}

function spawn(
  ctx: SimContext,
  species: MobSpecies,
  at: BlockId,
  rng: RngState,
  options: { until: number; hired?: boolean; intent?: Mob['intent']; target?: BlockId | null },
): Mob {
  const { state, world, events } = ctx;
  const [x, z] = centre(world, at);
  const mob: Mob = {
    id: state.nextMobId++,
    species,
    x,
    z,
    tx: x,
    tz: z,
    intent: options.intent ?? 'wander',
    target: options.target ?? null,
    born: state.tick,
    until: options.until,
    phase: nextFloat(rng),
    standing: false,
    hired: options.hired ?? false,
  };
  state.mobs.push(mob);
  events.push({ type: 'MobArrived', id: mob.id, species, block: at });
  return mob;
}

function bearingBlocks(state: SimState): BlockId[] {
  const out: BlockId[] = [];
  for (const [id, palms] of state.palms) {
    const block = state.blocks.get(id);
    if (block?.phase !== 'planted' || block.species !== 'palm') continue;
    for (let slot = 0; slot < palms.plantedAt.length; slot++) {
      if (palms.plantedAt[slot]! >= 0 && isBearing(slotStage(palms, slot, 'palm', state.tick))) {
        out.push(id);
        break;
      }
    }
  }
  return out.sort((a, b) => a - b);
}

function hasWorker(state: SimState, kind: WorkerKind): boolean {
  return state.mobs.some((m) => m.hired && m.species === kind);
}

// ── Spawning ──────────────────────────────────────────────────────────────

function spawnWildlife(ctx: SimContext, rng: RngState): void {
  const { state } = ctx;
  const wild = state.mobs.filter((m) => (WILD_KINDS as string[]).includes(m.species)).length;
  if (wild >= WILDLIFE.cap || !chance(rng, WILDLIFE.arrivePerDay)) return;

  const kind =
    WILD_KINDS[
      pickWeighted(
        rng,
        WILD_KINDS.map((k) => WILDLIFE.kinds[k].weight),
      )
    ];
  if (!kind) return;
  const spec = WILDLIFE.kinds[kind];
  const at = roamTarget(ctx, rng, spec.biomes, 'onPlanted' in spec && spec.onPlanted);
  if (at === null) return;
  const stay = WILDLIFE.stayDays.min + nextInt(rng, WILDLIFE.stayDays.max - WILDLIFE.stayDays.min);
  spawn(ctx, kind, at, rng, { until: state.tick + stay });
}

function spawnVisitors(ctx: SimContext, rng: RngState): void {
  const { state, world } = ctx;

  // The thief comes for ripe fruit — less often, and less successfully, when guarded.
  const ripe = bearingBlocks(state);
  const hasThief = state.mobs.some((m) => m.species === 'thief');
  if (ripe.length > 0 && !hasThief) {
    const guarded = hasWorker(state, 'security');
    const p = THIEF.arrivePerDay * (guarded ? THIEF.guardedFactor : 1);
    if (chance(rng, p)) {
      const target = ripe[nextInt(rng, ripe.length)]!;
      const edge = edgeNear(ctx, rng, target);
      const thief = spawn(ctx, 'thief', edge, rng, {
        until: state.tick + THIEF.stayDays,
        intent: 'travel',
        target,
      });
      [thief.tx, thief.tz] = centre(world, target);
    }
  }

  // The babi ngepet comes for the cash box at the Kopdes.
  const hasBabi = state.mobs.some((m) => m.species === 'babiNgepet');
  if (
    state.kopdes &&
    !hasBabi &&
    ripe.length > 0 &&
    state.economy.cash > 0 &&
    chance(rng, BABI_NGEPET.arrivePerDay)
  ) {
    const edge = edgeNear(ctx, rng, state.kopdes.blockId);
    const babi = spawn(ctx, 'babiNgepet', edge, rng, {
      until: state.tick + BABI_NGEPET.stayDays,
      intent: 'travel',
      target: state.kopdes.blockId,
    });
    [babi.tx, babi.tz] = centre(world, state.kopdes.blockId);
  }
}

/** A block at the edge of the roaming ring, on the far side from nowhere in particular. */
function edgeNear(ctx: SimContext, rng: RngState, target: BlockId): BlockId {
  const { world } = ctx;
  const [tx, ty] = world.toXY(target);
  const angle = nextFloat(rng) * Math.PI * 2;
  const x = clamp(Math.round(tx + Math.cos(angle) * ROAM), 0, world.width - 1);
  const y = clamp(Math.round(ty + Math.sin(angle) * ROAM), 0, world.height - 1);
  return world.toId(x, y);
}

function spawnGhost(ctx: SimContext, rng: RngState): void {
  const { state } = ctx;
  if (state.mobs.some((m) => m.species === 'ghost') || !chance(rng, GHOST.appearPerDay)) return;
  const abandoned: BlockId[] = [];
  for (const block of state.blocks.values()) {
    if (!block.owned || block.phase !== 'cleared') continue;
    // "Untouched": no harvest clock, and cleared long enough ago that the ash is gone.
    if (block.ashUntil > state.tick) continue;
    if (block.debris > 0 && block.debris < 3) continue;
    abandoned.push(block.id);
  }
  // A cleared block only counts once nothing has happened on it for a year.
  const eligible = abandoned.filter((id) => {
    const block = state.blocks.get(id)!;
    return (
      state.tick - Math.max(block.fertilizedUntil, block.lastHarvest, 0) >= GHOST.abandonedAfterDays
    );
  });
  if (eligible.length === 0) return;
  const at = eligible.sort((a, b) => a - b)[nextInt(rng, eligible.length)]!;
  const stay = GHOST.stayDays.min + nextInt(rng, GHOST.stayDays.max - GHOST.stayDays.min);
  spawn(ctx, 'ghost', at, rng, { until: state.tick + stay });
}

/** A crew stands on every block being chopped or burned. */
function spawnCrews(ctx: SimContext): void {
  const { state, world, events } = ctx;
  const working = new Set<BlockId>();
  for (const block of state.blocks.values()) {
    if (block.phase === 'clearing' || block.burning) working.add(block.id);
  }
  const present = new Set<BlockId>();
  for (const mob of state.mobs) {
    if (mob.species === 'crew' && mob.target !== null) present.add(mob.target);
  }
  for (const id of [...working].sort((a, b) => a - b)) {
    if (present.has(id)) continue;
    const [x, z] = centre(world, id);
    const mob: Mob = {
      id: state.nextMobId++,
      species: 'crew',
      x: x + 0.3,
      z: z + 0.3,
      tx: x - 0.3,
      tz: z - 0.3,
      intent: 'work',
      target: id,
      born: state.tick,
      until: Infinity,
      phase: (id % 97) / 97,
      standing: false,
      hired: false,
    };
    state.mobs.push(mob);
    events.push({ type: 'MobArrived', id: mob.id, species: 'crew', block: id });
  }
}

// ── Workers ───────────────────────────────────────────────────────────────

function payWages(ctx: SimContext): void {
  const { state } = ctx;
  for (const mob of state.mobs) {
    if (!mob.hired) continue;
    const spec = WORKERS[mob.species as WorkerKind];
    if (spec) spend(state, spec.wagePerDay, 'wages', `${spec.label}`);
  }
}

// ── Behaviour ─────────────────────────────────────────────────────────────

function step(ctx: SimContext, mob: Mob, rng: RngState): void {
  switch (mob.species) {
    case 'thief':
      return stepThief(ctx, mob, rng);
    case 'babiNgepet':
      return stepBabi(ctx, mob);
    case 'crew':
      return stepCrew(ctx, mob);
    case 'sanitizer':
      return stepSanitizer(ctx, mob, rng);
    case 'plantDoctor':
      return stepDoctor(ctx, mob, rng);
    case 'security':
      return stepSecurity(ctx, mob, rng);
    case 'ghost':
      return stepGhost(ctx, mob, rng);
    default:
      return stepWild(ctx, mob, rng);
  }
}

function stepWild(ctx: SimContext, mob: Mob, rng: RngState): void {
  const { state, world } = ctx;
  if (state.tick >= mob.until && mob.intent !== 'leave') {
    // Time to go: walk off the edge of the ring.
    const away = edgeNear(ctx, rng, mob.target ?? world.toId(Math.floor(mob.x), Math.floor(mob.z)));
    [mob.tx, mob.tz] = centre(world, away);
    mob.intent = 'leave';
  } else if (atTarget(mob) && chance(rng, 0.35)) {
    const spec = WILDLIFE.kinds[mob.species as keyof typeof WILDLIFE.kinds];
    const next = roamTarget(
      ctx,
      rng,
      spec?.biomes ?? null,
      spec !== undefined && 'onPlanted' in spec,
    );
    if (next !== null) {
      const [x, z] = centre(world, next);
      mob.tx = x + (nextFloat(rng) - 0.5) * 0.8;
      mob.tz = z + (nextFloat(rng) - 0.5) * 0.8;
      mob.target = next;
    }
  }
  walk(mob, WILDLIFE.speed);
}

function stepThief(ctx: SimContext, mob: Mob, rng: RngState): void {
  const { state, world, events } = ctx;
  if (mob.intent === 'leave') {
    walk(mob, THIEF.speed);
    return;
  }
  const guard = state.mobs.find((m) => m.hired && m.species === 'security');
  if (
    guard &&
    Math.hypot(guard.x - mob.x, guard.z - mob.z) < 2.5 &&
    chance(rng, THIEF.caughtChance)
  ) {
    events.push({ type: 'ThiefCaught', block: mob.target ?? 0 });
    leave(ctx, mob, rng);
    return;
  }
  walk(mob, THIEF.speed);
  if (!atTarget(mob) || mob.target === null) return;

  // At the block: take a share of what is on the trees, then slip away.
  const palms = state.palms.get(mob.target);
  let taken = 0;
  if (palms) {
    for (let slot = 0; slot < palms.plantedAt.length; slot++) {
      if (palms.plantedAt[slot]! < 0) continue;
      const share = palms.yieldAcc[slot]! * THIEF.takeShare;
      palms.yieldAcc[slot] = palms.yieldAcc[slot]! - share;
      taken += share;
    }
  }
  if (taken > 0.5) events.push({ type: 'HarvestStolen', block: mob.target, kilograms: taken });
  else {
    // Nothing worth taking here; try another ripe block if there is one.
    const ripe = bearingBlocks(state).filter((id) => id !== mob.target);
    if (ripe.length > 0 && state.tick < mob.until) {
      mob.target = ripe[nextInt(rng, ripe.length)]!;
      [mob.tx, mob.tz] = centre(world, mob.target);
      return;
    }
  }
  leave(ctx, mob, rng);
}

function stepBabi(ctx: SimContext, mob: Mob): void {
  const { state, world, events } = ctx;
  if (mob.intent === 'leave') {
    walk(mob, BABI_NGEPET.speed);
    return;
  }
  walk(mob, BABI_NGEPET.speed);
  if (!atTarget(mob)) return;
  // At the Kopdes it stands up, and the cash box is lighter.
  mob.standing = true;
  const take = Math.min(
    BABI_NGEPET.maxTake,
    Math.round(state.economy.cash * BABI_NGEPET.takeShare),
  );
  if (take > 0) {
    spend(state, take, 'fine', 'babi ngepet');
    events.push({ type: 'CashStolen', amount: take });
    events.push({ type: 'CashChanged', cash: state.economy.cash });
  }
  const b = estateBounds(state, world);
  mob.tx = clamp(b.minX - ROAM, 0, world.width - 1) + 0.5;
  mob.tz = mob.z;
  mob.intent = 'leave';
}

function leave(ctx: SimContext, mob: Mob, rng: RngState): void {
  const { world } = ctx;
  const away = edgeNear(ctx, rng, mob.target ?? world.toId(Math.floor(mob.x), Math.floor(mob.z)));
  [mob.tx, mob.tz] = centre(world, away);
  mob.intent = 'leave';
}

function stepCrew(ctx: SimContext, mob: Mob): void {
  const { state, world } = ctx;
  const block = mob.target === null ? null : state.blocks.get(mob.target);
  const stillWorking =
    block !== null && block !== undefined && (block.phase === 'clearing' || block.burning);
  if (!stillWorking) {
    // Job done: the crew is off the books next tick.
    mob.intent = 'leave';
    mob.until = state.tick;
    mob.tx = mob.x;
    mob.tz = mob.z;
    return;
  }
  // Pace about the block.
  if (atTarget(mob)) {
    const [cx, cz] = centre(world, mob.target!);
    mob.tx = cx + (mob.tx > cx ? -0.3 : 0.3);
    mob.tz = cz + (mob.tz > cz ? -0.3 : 0.3);
  }
  walk(mob, WORKER_JOBS.crewSpeed * 0.5);
}

/** Where a hired worker idles when there is nothing to do: the Kopdes. */
function idleAtKopdes(ctx: SimContext, mob: Mob): void {
  const { state, world } = ctx;
  if (!state.kopdes) return;
  const [x, z] = centre(world, state.kopdes.blockId);
  mob.tx = x + 0.6;
  mob.tz = z + 0.6;
  mob.target = null;
  mob.intent = 'wander';
}

function stepSanitizer(ctx: SimContext, mob: Mob, rng: RngState): void {
  const { state, world, events } = ctx;
  if (mob.target === null) {
    let best: Block | null = null;
    for (const block of state.blocks.values()) {
      if (!block.owned || block.burning || block.debris < WORKER_JOBS.sanitizeAbove) continue;
      if (
        !best ||
        block.debris > best.debris ||
        (block.debris === best.debris && block.id < best.id)
      )
        best = block;
    }
    if (best) {
      mob.target = best.id;
      [mob.tx, mob.tz] = centre(world, best.id);
      mob.intent = 'travel';
    } else idleAtKopdes(ctx, mob);
  }
  walk(mob, WORKERS.sanitizer.speed);
  if (mob.target === null || !atTarget(mob)) return;
  const block = writeBlock(state, world, mob.target);
  mob.intent = 'work';
  block.debris = Math.max(0, block.debris - WORKER_JOBS.sanitizePerDay);
  events.push({ type: 'BlockSanitized', block: block.id, debris: block.debris });
  events.push({ type: 'BlockChanged', block: block.id });
  if (block.debris <= 0 || (block.debris < WORKER_JOBS.sanitizeAbove && chance(rng, 0.5))) {
    mob.target = null;
  }
}

function stepDoctor(ctx: SimContext, mob: Mob, rng: RngState): void {
  const { state, world, events } = ctx;
  if (mob.target === null) {
    let bestId: BlockId | null = null;
    let bestSick = 0;
    for (const [id, palms] of state.palms) {
      const block = state.blocks.get(id);
      if (block?.phase !== 'planted' || block.species !== 'palm') continue;
      const counts = ganodermaCounts(palms);
      const sick = counts.symptomatic + counts.dead;
      if (sick > bestSick) {
        bestSick = sick;
        bestId = id;
      }
    }
    if (bestId !== null) {
      mob.target = bestId;
      [mob.tx, mob.tz] = centre(world, bestId);
      mob.intent = 'travel';
    } else idleAtKopdes(ctx, mob);
  }
  walk(mob, WORKERS.plantDoctor.speed);
  if (mob.target === null || !atTarget(mob)) return;
  mob.intent = 'work';
  const palms = state.palms.get(mob.target);
  const block = state.blocks.get(mob.target);
  if (!palms || !block) {
    mob.target = null;
    return;
  }
  // Pull the visibly sick and the stumps, a few a day, and dose the block.
  let removed = 0;
  for (
    let slot = 0;
    slot < palms.plantedAt.length && removed < WORKER_JOBS.removalsPerDay;
    slot++
  ) {
    if (palms.plantedAt[slot]! < 0 || palms.ganoderma[slot]! < 2) continue;
    palms.plantedAt[slot] = -1;
    palms.growth[slot] = 0;
    palms.health[slot] = 0;
    palms.ganoderma[slot] = 0;
    palms.ganodermaSince[slot] = -1;
    palms.yieldAcc[slot] = 0;
    events.push({ type: 'PalmRemoved', block: mob.target, slot });
    removed += 1;
  }
  if (block.trichodermaUntil <= state.tick) {
    const from = state.tick;
    writeBlock(state, world, mob.target).trichodermaUntil = from + 120;
    events.push({ type: 'BlockTreated', block: mob.target, treatment: 'trichoderma' });
  }
  const counts = ganodermaCounts(palms);
  if (counts.symptomatic + counts.dead === 0 || chance(rng, 0.05)) mob.target = null;
}

function stepSecurity(ctx: SimContext, mob: Mob, rng: RngState): void {
  const { state, world } = ctx;
  const thief = state.mobs.find((m) => m.species === 'thief' && m.intent !== 'leave');
  if (thief) {
    // Head for the thief.
    mob.tx = thief.x;
    mob.tz = thief.z;
    mob.intent = 'travel';
  } else if (atTarget(mob) || mob.target === null) {
    // Patrol the ripe blocks.
    const ripe = bearingBlocks(state);
    if (ripe.length > 0) {
      mob.target = ripe[nextInt(rng, ripe.length)]!;
      [mob.tx, mob.tz] = centre(world, mob.target);
      mob.intent = 'travel';
    } else idleAtKopdes(ctx, mob);
  }
  walk(mob, WORKERS.security.speed);
}

function stepGhost(_ctx: SimContext, mob: Mob, rng: RngState): void {
  // Drifts a little, never far, and fades when its time is up.
  if (atTarget(mob)) {
    mob.tx = mob.x + (nextFloat(rng) - 0.5) * 0.6;
    mob.tz = mob.z + (nextFloat(rng) - 0.5) * 0.6;
  }
  walk(mob, 0.2);
}

/** The wild kinds, for the renderer and the tests. */
export function wildKinds(): readonly MobSpecies[] {
  return WILD_KINDS;
}
