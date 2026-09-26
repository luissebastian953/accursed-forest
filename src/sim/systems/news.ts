import { GROWTH } from '../balance/growth.ts';
import {
  NEWS,
  NEWS_TEMPLATES,
  kopdesNewsKey,
  macroNewsKey,
  regionName,
  type NewsTemplate,
} from '../balance/news/index.ts';
import { KOPDES_TBS_SHARE } from '../balance/prices.ts';
import { MACRO } from '../balance/society.ts';
import { blockLabel } from '../labels.ts';
import { forestCoverAround } from '../landscape.ts';
import { chance, forkRng, pick, type RngState } from '../rng.ts';
import { chronicle } from '../run.ts';
import type { SimContext } from '../state.ts';
import type { BlockId, NewsItem, SimState } from '../types.ts';
import { estateCodeFor } from '../worldgen/index.ts';

export interface NewsVars {
  n?: number;
  days?: number;
  pct?: string;
  price?: string;
  block?: string;
  until?: string;
  cost?: string;
}

interface Pending {
  key: string;
  vars: NewsVars;
  blocks: BlockId[];
}

const rupiah = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 });

function dateLabel(tick: number): string {
  return `Year ${Math.floor(tick / GROWTH.daysPerYear) + 1}, day ${(tick % GROWTH.daysPerYear) + 1}`;
}

export function render(text: string, state: SimState, vars: NewsVars): string {
  const values: Record<string, string> = {
    region: regionName(state.seed),
    estate: `estate ${estateCodeFor(state.seed)}`,
    n: vars.n === undefined ? '' : rupiah.format(Math.round(vars.n)),
    days: vars.days === undefined ? '' : String(vars.days),
    pct: vars.pct ?? '',
    price: vars.price ?? '',
    block: vars.block ?? '',
    until: vars.until ?? '',
    cost: vars.cost ?? '',
  };

  return text.replace(/\{(\w+)\}/g, (match, name: string) => values[name] ?? match);
}

/** A headline that opens on a slot ("{estate} folds…") still starts with a capital. */
function capitalise(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * Headlines draw from their own stream: their words must never shift the
 * world's future rolls.
 */
const NEWS_STREAM = 0x4e455753;

function newsRng(state: SimState): RngState {
  return forkRng(state.seed ^ NEWS_STREAM, state.tick);
}

/** Publish one headline from a template, honouring its cooldown. Returns the item, or null. */
export function publish(
  ctx: SimContext,
  key: string,
  vars: NewsVars = {},
  blocks: BlockId[] = [],
  rng: RngState = newsRng(ctx.state),
): NewsItem | null {
  const { state, events } = ctx;
  const template: NewsTemplate | undefined = NEWS_TEMPLATES[key];

  if (!template) return null;

  const news = state.society.news;

  for (let i = news.length - 1; i >= 0; i--) {
    const item = news[i]!;

    if (state.tick - item.tick > template.cooldownDays) break;
    if (item.key === key && state.tick - item.tick < template.cooldownDays) return null;
  }

  const item: NewsItem = {
    tick: state.tick,
    key,
    lane: template.lane,
    severity: template.severity,
    title: capitalise(render(pick(rng, template.titles) ?? key, state, vars)),
    body: render(pick(rng, template.bodies) ?? '', state, vars),
    effects: template.effects.map((e) => render(e, state, vars)).filter((e) => e.trim().length > 0),
  };

  if (blocks.length > 0) item.blocks = blocks;

  news.push(item);
  if (news.length > NEWS.cap) news.splice(0, news.length - NEWS.cap);

  if (template.chronicle ?? (item.severity === 'warning' || item.severity === 'critical')) {
    chronicle(state, { lane: item.lane, severity: item.severity, title: item.title });
  }

  events.push({ type: 'NewsPublished', key, lane: item.lane, severity: item.severity });
  return item;
}

export function newsSystem(ctx: SimContext): void {
  const { state, world } = ctx;
  const pending = new Map<string, Pending>();
  const add = (key: string, vars: NewsVars = {}, blocks: BlockId[] = []): void => {
    const existing = pending.get(key);

    if (existing) {
      existing.blocks.push(...blocks);
      if (vars.n !== undefined) existing.vars.n = (existing.vars.n ?? 0) + vars.n;
      return;
    }

    pending.set(key, { key, vars: { ...vars }, blocks: [...blocks] });
  };

  let wildfireNow = false;
  const snapshot = [...ctx.events.peek()];

  for (const event of snapshot) {
    switch (event.type) {
      case 'WildfireStarted':
        wildfireNow = true;
        add('wildfire.start');
        break;

      case 'WeatherEventStarted': {
        const active = state.weather.activeEvents.find((e) => e.id === event.id);

        if (event.id === 'haze') add('haze.start', { days: event.days });
        else if (event.id === 'ash') add('ash.start', { days: event.days });
        else if (event.id === 'flood')
          add(
            (active?.blocks?.length ?? 0) > 0 ? 'flood.start' : 'flood.regional',
            { days: event.days, n: active?.blocks?.length ?? 0 },
            active?.blocks ?? [],
          );
        else if (event.id === 'drought') add('drought.start');
        break;
      }

      case 'WeatherEventEnded':
        if (event.id === 'drought') add('drought.end');
        break;

      case 'Landslide': {
        const bare = forestCoverAround(state, world, event.block) < 0.3;

        if (bare || event.palmsLost > 0)
          add(
            'landslide',
            { n: event.palmsLost, block: `block ${blockLabel(world, event.block)}` },
            [event.block],
          );
        break;
      }

      case 'HarvestStolen':
        add(
          'estate.theft',
          { n: event.kilograms, block: `block ${blockLabel(world, event.block)}` },
          [event.block],
        );
        break;
      case 'ThiefCaught':
        add('estate.thiefCaught');
        break;
      case 'CashStolen':
        add('estate.babiNgepet', { cost: `Rp ${rupiah.format(event.amount)}` });
        break;
      case 'LightningStruck':
        if (event.ignited) add('storm.lightning', {}, [event.block]);
        break;
      case 'PlagueStarted':
        add('plague.start', {}, [event.block]);
        break;
      case 'YearPassed':
        if (state.weather.regime !== 'normal') add(`regime.${state.weather.regime}`);
        break;
      case 'MacroEventStarted':
        add(macroNewsKey(event.id), {
          days: event.days,
          pct: `${(1 + ((MACRO.events as Record<string, { inputRise?: number }>)[event.id]?.inputRise ?? 0)).toFixed(2)}`,
        });
        break;
      case 'TbsSold':
        if (Math.abs(state.economy.soldKgTotal - event.kilograms) < 1e-6) {
          add('estate.firstSale', {
            n: event.kilograms,
            price: `Rp ${rupiah.format(event.price)}`,
          });
        }

        break;

      case 'KopdesUpgraded': {
        const key = kopdesNewsKey(event.level);
        const share = KOPDES_TBS_SHARE[event.level] ?? 1;

        if (key) add(key, { pct: `${Math.round(share * 100)}%` });
        break;
      }

      case 'IntegrityScandal':
        add('gov.scandal');
        break;
      case 'LetterReceived':
        add('authority.letter');
        break;
      case 'InvestigationOpened':
        add(`authority.investigation.${event.reason}`, { until: dateLabel(event.until) });
        break;
      case 'InvestigationSettled':
        add('authority.settled', { cost: `Rp ${rupiah.format(event.cost)}` });
        break;
      case 'InvestigationClosed':
        add('authority.closed');
        break;
      case 'Arrested':
        add('authority.arrested');
        break;
      case 'OperatingBanned':
        add('authority.operatingBan', { until: dateLabel(event.until) });
        break;
      case 'OperatingBanLifted':
        add('authority.banLifted');
        break;
      case 'Certified':
        add(event.clean ? 'palmCert.clean' : 'palmCert.dirty');
        if (!event.clean) add('palmCert.dirtyHaze');
        break;
      case 'RunEnded':
        if (
          event.ending === 'fade' ||
          event.ending === 'reboisasi' ||
          event.ending === 'redemption' ||
          event.ending === 'bankrupt' ||
          event.ending === 'banned'
        )
          add(`ending.${event.ending}`, { days: state.run.insolventFor });
        break;
      default:
        break;
    }
  }

  // Smoke from your own wildfire is the wildfire's story, not a separate one.
  if (wildfireNow) pending.delete('haze.start');

  // The price, checked monthly against a month ago.
  const history = state.economy.tbsPriceHistory;

  if (state.tick > 0 && state.tick % 30 === 0 && history.length > 30) {
    const then = history[history.length - 31]!;
    const now = state.economy.tbsPrice;
    const move = (now - then) / then;

    if (Math.abs(move) >= NEWS.priceMoveHeadline) {
      add(move > 0 ? 'price.surge' : 'price.slump', {
        pct: `${Math.round(Math.abs(move) * 100)}%`,
        price: `Rp ${rupiah.format(now)}`,
      });
    }
  }

  const rng = newsRng(state);

  for (const item of pending.values()) {
    const published = publish(ctx, item.key, item.vars, item.blocks, rng);

    // The government reacts to the big natural stories; integrity decides whether it means it.
    if (
      published &&
      (item.key === 'wildfire.start' ||
        item.key === 'haze.start' ||
        item.key === 'flood.start' ||
        item.key === 'flood.regional')
    ) {
      if (chance(rng, NEWS.governmentReactionChance)) {
        const topic = item.key.startsWith('flood.') ? 'gov.floodRelief' : 'gov.fireResponse';
        const tone = state.society.integrity >= NEWS.realResponseIntegrity ? 'real' : 'hollow';

        publish(ctx, `${topic}.${tone}`, {}, [], rng);
      }
    }
  }
}
