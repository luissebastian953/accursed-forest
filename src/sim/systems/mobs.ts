/**
 * Mobs (POC → game): wild animals for the eye, a thief and a babi ngepet for
 * the ledger, ghosts for the abandoned corners, and the workers you pay.
 *
 * Runs after the economy and before society, so a theft shows up in the
 * day's books and the news. Every roll comes from its own stream, forked
 * from the seed and the tick: a crowd of boars must never shift the weather.
 *
 * Positions are in block units. A mob walks toward its target a fraction of
 * a block a day; the renderer walks it there between ticks. Animals live on
 * a small repertoire; stand, mill about, cross the estate, circle, sleep;
 * and pick the next thing when the current one runs out.
 */

import { clamp } from '@shared/math';

import { BIOMES } from '../balance/biomes.ts';
import {
  BABI_NGEPET,
  BEHAVIOUR,
  CLIMB,
  HABITS,
  SHINY,
  SPECIES_HABITS,
  GHOST,
  MOB_STREAM,
  ROAM,
  THIEF,
  WILDLIFE,
  WORKERS,
  WORKER_JOBS,
  type WorkerKind,
} from '../balance/mobs.ts';
import { isWildfire } from '../fire.ts';
import { isBearing, slotStage } from '../palms.ts';
import { chance, forkRng, nextFloat, nextInt, pickWeighted, type RngState } from '../rng.ts';
import { readBlock, spend, writeBlock, type SimContext } from '../state.ts';
import type { Block, BlockId, Mob, MobIntent, MobSpecies, SimState } from '../types.ts';
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
  spawnCrews(ctx, rng);

  for (const mob of state.mobs) step(ctx, mob, rng);

  // Whoever has made it off the edge, or run out of time, goes.
  const staying: Mob[] = [];
  for (const mob of state.mobs) {
    const leaving = mob.intent === 'leave';
    const gone = leaving && (atTarget(mob) || state.tick >= mob.until + BEHAVIOUR.leaveGraceDays);
    const faded = !leaving && !mob.hired && mob.species !== 'crew' && state.tick >= mob.until;
    if (gone || faded) {
      ctx.events.push({ type: 'MobLeft', id: mob.id, species: mob.species });
    } else {
      staying.push(mob);
    }
  }
  state.mobs = staying;
}

// ── Helpers ───────────────────────────────────────────────────────────────

function atTarget(mob: Mob): boolean {
  return Math.hypot(mob.tx - mob.x, mob.tz - mob.z) < 0.05;
}

function centre(world: World, id: BlockId): [number, number] {
  const [x, y] = world.toXY(id);
  return [x + 0.5, y + 0.5];
}

function days(rng: RngState, range: { min: number; max: number }): number {
  return range.min + nextInt(rng, range.max - range.min + 1);
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

function headTo(mob: Mob, world: World, block: BlockId, intent: MobIntent, jitter = 0): void {
  const [x, z] = centre(world, block);
  mob.tx = x + (jitter ? (Math.sin(mob.phase * 97) * jitter) / 2 : 0);
  mob.tz = z + (jitter ? (Math.cos(mob.phase * 61) * jitter) / 2 : 0);
  mob.target = block;
  mob.intent = intent;
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

/** The estate's blocks, in id order, for anyone who walks it. */
function ownedBlocks(state: SimState): BlockId[] {
  const out: BlockId[] = [];
  for (const block of state.blocks.values()) if (block.owned) out.push(block.id);
  return out.sort((a, b) => a - b);
}

function spawn(
  ctx: SimContext,
  species: MobSpecies,
  at: BlockId,
  rng: RngState,
  options: { until: number; hired?: boolean; intent?: MobIntent; target?: BlockId | null },
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
    intent: options.intent ?? 'idle',
    target: options.target ?? null,
    born: state.tick,
    until: options.until,
    phase: nextFloat(rng),
    standing: false,
    climb: 0,
    shiny: false,
    hired: options.hired ?? false,
    intentUntil: state.tick,
    ax: x,
    az: z,
    heading: 0,
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

/** Where the security guard stands when not on patrol. */
export function guardPost(state: SimState, world: World): [number, number] | null {
  if (!state.kopdes) return null;
  const [x, z] = centre(world, state.kopdes.blockId);
  return [x + WORKER_JOBS.guardPost.dx, z + WORKER_JOBS.guardPost.dz];
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
  const stay = days(rng, WILDLIFE.stayDays);
  const mob = spawn(ctx, kind, at, rng, { until: state.tick + stay, target: at });
  // Every so often the capybara that turns up is the golden one.
  if (kind === 'capybara' && chance(rng, SHINY.chance)) mob.shiny = true;
  pickBehaviour(ctx, mob, rng, true);
}

function spawnVisitors(ctx: SimContext, rng: RngState): void {
  const { state, world } = ctx;

  // The thief comes for ripe fruit; less often, and less successfully, when guarded.
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
      // First to the trees near the block, to hide; the dash comes later.
      const hide = hidingTree(ctx, rng, target) ?? edge;
      [thief.ax, thief.az] = centre(world, hide);
      thief.tx = thief.ax;
      thief.tz = thief.az;
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

/** A wild block with trees on it within reach of the target, for a thief to wait in. */
function hidingTree(ctx: SimContext, rng: RngState, target: BlockId): BlockId | null {
  const { state, world } = ctx;
  const [tx, ty] = world.toXY(target);
  const candidates: BlockId[] = [];
  const r = THIEF.hideRadius;
  for (let y = ty - r; y <= ty + r; y++) {
    for (let x = tx - r; x <= tx + r; x++) {
      if (!world.inBounds(x, y) || (x === tx && y === ty)) continue;
      const block = readBlock(state, world, world.toId(x, y));
      if (block.phase === 'wild' && BIOMES[block.biome].forestCover) candidates.push(block.id);
    }
  }
  if (candidates.length === 0) return null;
  return candidates.sort((a, b) => a - b)[nextInt(rng, candidates.length)]!;
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
  const stay = days(rng, GHOST.stayDays);
  const ghost = spawn(ctx, 'ghost', at, rng, { until: state.tick + stay, target: at });
  pickBehaviour(ctx, ghost, rng, false);
}

/**
 * Keep every worked block's crew topped up. A chop is always the player's
 * order, so every clearing block is staffed, and so is every block being dug
 * out after a slide. A fire is only the player's if
 * the burn command staffed it: lightning, a drought spark and a fire that
 * spread in from next door burn with nobody standing round them; and once
 * the pressure tips into a wildfire, nobody works any fire at all.
 */
function spawnCrews(ctx: SimContext, rng: RngState): void {
  const { state } = ctx;
  if (isWildfire(state)) return;
  const staffed = new Set<BlockId>();
  for (const mob of state.mobs)
    if (mob.species === 'crew' && mob.target !== null) staffed.add(mob.target);
  const working: BlockId[] = [];
  for (const block of state.blocks.values()) {
    if (
      block.phase === 'clearing' ||
      block.excavateUntil > state.tick ||
      (block.burning && staffed.has(block.id))
    )
      working.push(block.id);
  }
  for (const id of working.sort((a, b) => a - b)) staffBlock(ctx, id, rng);
}

/** Blocks with a crew on them: the player's own jobs, for the scaffolding. */
export function workedBlocks(state: SimState): Set<BlockId> {
  const out = new Set<BlockId>();
  for (const mob of state.mobs)
    if (mob.species === 'crew' && mob.target !== null) out.add(mob.target);
  return out;
}

/**
 * Top a block's crew up to `crewSize`. The chop and burn commands call this
 * the moment the order is given, so the crew is on the block before the
 * next day's tick; at ten seconds a day, waiting for it read as a delay.
 */
export function staffBlock(ctx: SimContext, id: BlockId, rng?: RngState): void {
  const { state } = ctx;
  const draw = rng ?? forkRng(state.seed ^ MOB_STREAM ^ id, state.tick);
  let present = 0;
  for (const mob of state.mobs) if (mob.species === 'crew' && mob.target === id) present += 1;
  for (let n = present; n < WORKER_JOBS.crewSize; n++) {
    const crew = spawn(ctx, 'crew', id, draw, { until: Infinity, intent: 'work', target: id });
    workSpot(crew, draw);
    // Spread the first spots out so four people do not start on one tree.
    crew.x = crew.tx;
    crew.z = crew.tz;
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
      return stepBabi(ctx, mob, rng);
    case 'crew':
      return stepCrew(ctx, mob, rng);
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

const REPERTOIRE = [
  'idle',
  'sit',
  'pace',
  'wander',
  'circle',
  'sleep',
  'climb',
  'climbJump',
] as const;

/** Is there anything here to climb? */
function overTrees(ctx: SimContext, mob: Mob): boolean {
  const { state, world } = ctx;
  const bx = Math.floor(mob.x);
  const bz = Math.floor(mob.z);
  if (!world.inBounds(bx, bz)) return false;
  const block = readBlock(state, world, world.toId(bx, bz));
  if (block.phase === 'reforesting') return true;
  return block.phase === 'wild' && CLIMB.biomes.includes(block.biome);
}

/** Choose what an animal does next, and for how long. */
function pickBehaviour(ctx: SimContext, mob: Mob, rng: RngState, canSleep: boolean): void {
  const { state } = ctx;
  const habit = SPECIES_HABITS[mob.species];
  const table: Partial<Record<(typeof REPERTOIRE)[number], number>> = habit
    ? HABITS[habit]
    : BEHAVIOUR.weights;
  const trees = overTrees(ctx, mob);
  const weights = REPERTOIRE.map((k) => {
    if (k === 'sleep' && !canSleep) return 0;
    if ((k === 'climb' || k === 'climbJump') && !trees) return 0;
    return table[k] ?? 0;
  });
  const next = REPERTOIRE[pickWeighted(rng, weights)] ?? 'idle';
  mob.standing = false;
  mob.climb = 0;
  mob.tx = mob.x;
  mob.tz = mob.z;
  switch (next) {
    case 'idle':
      mob.intent = 'idle';
      mob.intentUntil = state.tick + days(rng, BEHAVIOUR.idleDays);
      break;
    case 'sit':
      mob.intent = 'sit';
      mob.intentUntil = state.tick + days(rng, BEHAVIOUR.sitDays);
      break;
    case 'climb':
      // Up the tree it is standing under, and it stays there a while.
      mob.intent = 'climb';
      mob.climb = CLIMB.height.min + nextFloat(rng) * (CLIMB.height.max - CLIMB.height.min);
      mob.ax = mob.x;
      mob.az = mob.z;
      mob.intentUntil = state.tick + days(rng, CLIMB.climbDays);
      break;
    case 'climbJump': {
      // Two trees a short way apart, and back and forth between them.
      const a = nextFloat(rng) * Math.PI * 2;
      const span = CLIMB.jumpSpan.min + nextFloat(rng) * (CLIMB.jumpSpan.max - CLIMB.jumpSpan.min);
      mob.intent = 'climbJump';
      mob.climb = CLIMB.height.min + nextFloat(rng) * (CLIMB.height.max - CLIMB.height.min);
      mob.ax = mob.x;
      mob.az = mob.z;
      mob.tx = mob.x + Math.cos(a) * span;
      mob.tz = mob.z + Math.sin(a) * span;
      mob.heading = a;
      mob.intentUntil = state.tick + days(rng, CLIMB.jumpDays);
      break;
    }
    case 'sleep':
      mob.intent = 'sleep';
      mob.intentUntil = state.tick + days(rng, BEHAVIOUR.sleepDays);
      break;
    case 'pace':
      mob.intent = 'pace';
      mob.ax = mob.x;
      mob.az = mob.z;
      mob.intentUntil = state.tick + days(rng, BEHAVIOUR.paceDays);
      paceTarget(mob, rng, BEHAVIOUR.paceRadius);
      break;
    case 'circle': {
      // The centre sits off to one side; the mob starts on the rim.
      const r = BEHAVIOUR.circleRadius.min + nextFloat(rng) * (BEHAVIOUR.circleRadius.max - 1);
      const a = nextFloat(rng) * Math.PI * 2;
      mob.ax = mob.x - Math.cos(a) * r;
      mob.az = mob.z - Math.sin(a) * r;
      mob.heading = a;
      mob.intent = 'circle';
      mob.intentUntil = state.tick + days(rng, BEHAVIOUR.wanderDays);
      break;
    }
    case 'wander': {
      const spec = WILDLIFE.kinds[mob.species as keyof typeof WILDLIFE.kinds];
      const to = roamTarget(
        ctx,
        rng,
        spec?.biomes ?? null,
        spec !== undefined && 'onPlanted' in spec,
      );
      if (to === null) {
        mob.intent = 'idle';
        mob.intentUntil = state.tick + days(rng, BEHAVIOUR.idleDays);
        break;
      }
      headTo(mob, ctx.world, to, 'wander', 0.8);
      mob.intentUntil = state.tick + days(rng, BEHAVIOUR.wanderDays);
      break;
    }
  }
}

function paceTarget(mob: Mob, rng: RngState, radius: number): void {
  const a = nextFloat(rng) * Math.PI * 2;
  const r = radius * (0.4 + nextFloat(rng) * 0.6);
  mob.tx = mob.ax + Math.cos(a) * r;
  mob.tz = mob.az + Math.sin(a) * r;
}

/** One day of the animal repertoire; returns false once the mob is leaving. */
function stepRepertoire(
  ctx: SimContext,
  mob: Mob,
  rng: RngState,
  speeds: { pace: number; wander: number },
  canSleep: boolean,
): void {
  const { state } = ctx;
  if (state.tick >= mob.intentUntil) pickBehaviour(ctx, mob, rng, canSleep);
  switch (mob.intent) {
    case 'idle':
    case 'sit':
    case 'sleep':
    case 'climb':
      return;
    case 'climbJump': {
      // At the far tree, it turns round and goes back to the near one.
      if (atTarget(mob)) {
        const [tx, tz] = [mob.ax, mob.az];
        mob.ax = mob.tx;
        mob.az = mob.tz;
        mob.tx = tx;
        mob.tz = tz;
      }
      walk(mob, CLIMB.jumpSpeed);
      return;
    }
    case 'pace':
      if (atTarget(mob)) {
        // A pause at each turn, now and then a longer one.
        if (chance(rng, 0.3)) mob.intentUntil = Math.min(mob.intentUntil, state.tick + 1);
        paceTarget(mob, rng, BEHAVIOUR.paceRadius);
      }
      walk(mob, speeds.pace);
      return;
    case 'circle': {
      const r = Math.hypot(mob.x - mob.ax, mob.z - mob.az) || BEHAVIOUR.circleRadius.min;
      mob.heading += (mob.phase < 0.5 ? 1 : -1) * BEHAVIOUR.circleTurn * (speeds.wander / 0.28);
      mob.tx = mob.ax + Math.cos(mob.heading) * r;
      mob.tz = mob.az + Math.sin(mob.heading) * r;
      walk(mob, speeds.wander);
      return;
    }
    case 'wander':
      walk(mob, speeds.wander);
      if (atTarget(mob)) pickBehaviour(ctx, mob, rng, canSleep);
      return;
    default:
      // Anything else (an old save's `travel`) settles into the repertoire.
      pickBehaviour(ctx, mob, rng, canSleep);
  }
}

function stepWild(ctx: SimContext, mob: Mob, rng: RngState): void {
  const { state, world } = ctx;
  if (mob.intent === 'leave') {
    walk(mob, WILDLIFE.wanderSpeed);
    return;
  }
  if (state.tick >= mob.until) {
    // Time to go: down out of the tree, and off the edge of the ring.
    const away = edgeNear(ctx, rng, mob.target ?? world.toId(Math.floor(mob.x), Math.floor(mob.z)));
    [mob.tx, mob.tz] = centre(world, away);
    mob.intent = 'leave';
    mob.climb = 0;
    return;
  }
  stepRepertoire(ctx, mob, rng, { pace: WILDLIFE.paceSpeed, wander: WILDLIFE.wanderSpeed }, true);
}

function stepGhost(ctx: SimContext, mob: Mob, rng: RngState): void {
  // Drifts through the same repertoire, slowly, never sleeps, and fades when its time is up.
  if (mob.intent === 'wander') {
    // Never far from its block: a wander is just a longer pace.
    mob.intent = 'pace';
    mob.ax = mob.x;
    mob.az = mob.z;
    paceTarget(mob, rng, BEHAVIOUR.paceRadius * 1.5);
  }
  stepRepertoire(ctx, mob, rng, { pace: GHOST.speed, wander: GHOST.speed * 1.5 }, false);
}

function stepThief(ctx: SimContext, mob: Mob, rng: RngState): void {
  const { state, world, events } = ctx;
  if (mob.intent === 'leave') {
    walk(mob, THIEF.sneakSpeed);
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
  switch (mob.intent) {
    case 'travel':
      // Creeping to the trees by the block.
      walk(mob, THIEF.sneakSpeed);
      if (atTarget(mob)) {
        mob.intent = 'hide';
        mob.intentUntil = state.tick + days(rng, THIEF.hideDays);
      }
      return;
    case 'hide':
      if (state.tick >= mob.intentUntil && mob.target !== null) {
        headTo(mob, world, mob.target, 'raid');
      }
      return;
    case 'raid':
      walk(mob, THIEF.raidSpeed);
      if (!atTarget(mob) || mob.target === null) return;
      break;
    case 'flee':
      // Back to the trees with the sack, then away.
      walk(mob, THIEF.raidSpeed);
      if (atTarget(mob)) leave(ctx, mob, rng);
      return;
    default:
      headTo(mob, world, mob.target ?? world.toId(Math.floor(mob.x), Math.floor(mob.z)), 'raid');
      return;
  }

  // At the block: take a share of what is on the trees, then dash back to the trees.
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
  if (taken > 0.5) {
    events.push({ type: 'HarvestStolen', block: mob.target, kilograms: taken });
    mob.tx = mob.ax;
    mob.tz = mob.az;
    mob.intent = 'flee';
    return;
  }
  // Nothing worth taking here; try another ripe block if there is one.
  const ripe = bearingBlocks(state).filter((id) => id !== mob.target);
  if (ripe.length > 0 && state.tick < mob.until) {
    headTo(mob, world, ripe[nextInt(rng, ripe.length)]!, 'raid');
    return;
  }
  leave(ctx, mob, rng);
}

function stepBabi(ctx: SimContext, mob: Mob, rng: RngState): void {
  const { state, world, events } = ctx;
  switch (mob.intent) {
    case 'leave':
      // Startled, it goes faster than it ever came.
      walk(mob, mob.standing ? BABI_NGEPET.fleeSpeed : BABI_NGEPET.raidSpeed);
      return;
    case 'raid': {
      // Upright, it runs the estate for a few days, then is simply gone.
      if (state.tick >= mob.intentUntil) {
        mob.until = state.tick;
        mob.intent = 'leave';
        mob.tx = mob.x;
        mob.tz = mob.z;
        return;
      }
      if (atTarget(mob)) {
        const owned = ownedBlocks(state);
        if (owned.length > 0) headTo(mob, world, owned[nextInt(rng, owned.length)]!, 'raid', 0.8);
      }
      walk(mob, BABI_NGEPET.raidSpeed);
      return;
    }
    default:
      // Ambling in as a pig.
      walk(mob, BABI_NGEPET.pigSpeed);
      if (!atTarget(mob)) return;
  }
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
  mob.intent = 'raid';
  mob.intentUntil = state.tick + BABI_NGEPET.raidDays;
}

/**
 * Seen and startled: it drops what it was carrying and bolts for the edge.
 * The tap command calls this; the walk itself is the usual leave.
 */
export function startle(ctx: SimContext, mob: Mob): void {
  const { world } = ctx;
  const [x, y] = world.toXY(world.toId(Math.floor(mob.x), Math.floor(mob.z)));
  // Straight out the nearest side, at a run.
  const left = x;
  const right = world.width - 1 - x;
  const up = y;
  const down = world.height - 1 - y;
  const shortest = Math.min(left, right, up, down);
  mob.tx = shortest === left ? -1 : shortest === right ? world.width : mob.x;
  mob.tz = shortest === up ? -1 : shortest === down ? world.height : mob.z;
  mob.intent = 'leave';
  mob.climb = 0;
  mob.until = ctx.state.tick;
}

function leave(ctx: SimContext, mob: Mob, rng: RngState): void {
  const { world } = ctx;
  const away = edgeNear(ctx, rng, mob.target ?? world.toId(Math.floor(mob.x), Math.floor(mob.z)));
  [mob.tx, mob.tz] = centre(world, away);
  mob.intent = 'leave';
}

/** A spot on the crew's block to work from, for a few days. */
function workSpot(mob: Mob, rng: RngState): void {
  mob.tx = mob.ax + (nextFloat(rng) - 0.5) * 0.7;
  mob.tz = mob.az + (nextFloat(rng) - 0.5) * 0.7;
  mob.intentUntil = mob.born + days(rng, WORKER_JOBS.crewSpotDays);
}

function stepCrew(ctx: SimContext, mob: Mob, rng: RngState): void {
  const { state } = ctx;
  const block = mob.target === null ? null : state.blocks.get(mob.target);
  // A wildfire is nobody's job: the crews walk off it.
  const stillWorking =
    block !== null &&
    block !== undefined &&
    (block.phase === 'clearing' ||
      block.excavateUntil > state.tick ||
      (block.burning && !isWildfire(state)));
  if (!stillWorking) {
    // Job done: the crew is off the books next tick.
    mob.intent = 'leave';
    mob.until = state.tick;
    mob.tx = mob.x;
    mob.tz = mob.z;
    return;
  }
  // Work a spot for a few days, then walk to the next tree.
  if (atTarget(mob) && state.tick >= mob.intentUntil) {
    workSpot(mob, rng);
    mob.intentUntil = state.tick + days(rng, WORKER_JOBS.crewSpotDays);
  }
  walk(mob, WORKER_JOBS.crewSpeed);
}

/** Where a hired worker idles when there is nothing to do: the Kopdes. */
function idleAtKopdes(ctx: SimContext, mob: Mob): void {
  const { state, world } = ctx;
  if (!state.kopdes) return;
  const [x, z] = centre(world, state.kopdes.blockId);
  mob.tx = x + 0.6;
  mob.tz = z + 0.6;
  mob.target = null;
  mob.intent = 'idle';
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
    if (best) headTo(mob, world, best.id, 'travel');
    else idleAtKopdes(ctx, mob);
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
    if (bestId !== null) headTo(mob, world, bestId, 'travel');
    else idleAtKopdes(ctx, mob);
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
    // Head for the thief, at a run.
    mob.tx = thief.x;
    mob.tz = thief.z;
    mob.target = null;
    mob.intent = 'travel';
    walk(mob, WORKER_JOBS.chaseSpeed);
    return;
  }
  if (mob.intent === 'idle' && state.tick < mob.intentUntil) return;
  if (atTarget(mob)) {
    const post = guardPost(state, world);
    if (mob.intent === 'travel' && mob.target === null && post) {
      // Arrived back at the post: rest a day or two.
      mob.intent = 'idle';
      mob.intentUntil = state.tick + days(rng, WORKER_JOBS.postDays);
      return;
    }
    if (mob.intent !== 'idle' && post && chance(rng, 0.5)) {
      [mob.tx, mob.tz] = post;
      mob.target = null;
      mob.intent = 'travel';
    } else {
      // Patrol: a random block of the estate, at a walk.
      const owned = ownedBlocks(state);
      if (owned.length > 0) headTo(mob, world, owned[nextInt(rng, owned.length)]!, 'travel', 0.6);
      else idleAtKopdes(ctx, mob);
    }
  }
  walk(mob, WORKERS.security.speed);
}

/** The wild kinds, for the renderer and the tests. */
export function wildKinds(): readonly MobSpecies[] {
  return WILD_KINDS;
}
