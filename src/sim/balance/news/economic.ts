/** Economic lane (§3.7): the price walk and the macro deck. */

import type { NewsTemplate } from './types.ts';

export const ECONOMIC: Record<string, NewsTemplate> = {
  'macro.rupiahSlide': {
    lane: 'economic',
    severity: 'warning',
    cooldownDays: 30,
    titles: ['Rupiah slides against the dollar', 'Currency weakens; importers pass costs on'],
    bodies: [
      'Fertilizer and seedlings cost more from today. Palm oil is priced in dollars, so fruit prices rise too — but by less.',
    ],
    effects: ['Input prices ×{pct}', 'TBS price rises by half as much'],
  },
  'macro.fertilizerSpike': {
    lane: 'economic',
    severity: 'notice',
    cooldownDays: 30,
    titles: ['Fertilizer prices jump on supply shortage', 'Urea shortage pushes estate costs up'],
    bodies: ['Suppliers blame shipping. Kopdes shelves show the new prices.'],
    effects: ['Input prices ×{pct}'],
  },
  'macro.biodieselMandate': {
    lane: 'economic',
    severity: 'notice',
    cooldownDays: 60,
    titles: [
      'Government raises the biodiesel blend mandate',
      'B50 mandate lifts domestic demand for palm oil',
    ],
    bodies: [
      'Mills are buying more fruit for the next {days} days or so. Prices are expected to firm.',
    ],
    effects: ['TBS price mean +10% for ~{days} days'],
  },
  'macro.euRestriction': {
    lane: 'economic',
    severity: 'warning',
    cooldownDays: 60,
    titles: [
      'European import rules tighten on palm oil',
      'Export buyers demand deforestation-free certificates',
    ],
    bodies: ['Traders expect weaker prices for months while supply chains adjust.'],
    effects: ['TBS price mean −12% for ~{days} days'],
  },
  'macro.millStrike': {
    lane: 'economic',
    severity: 'notice',
    cooldownDays: 30,
    titles: [
      'Mill workers strike over pay in {region}',
      'Strike slows fruit intake at mills in {region}',
    ],
    bodies: ['Fruit is backing up at the gates. Buyers are offering less until the strike ends.'],
    effects: ['TBS price mean −15% for ~{days} days'],
  },
  'macro.exportLevy': {
    lane: 'economic',
    severity: 'notice',
    cooldownDays: 60,
    titles: ['Export levy on palm oil raised', 'Ministry adjusts the CPO export levy, again'],
    bodies: ['Exporters say the cost will be passed back to growers.'],
    effects: ['TBS price mean −6% for ~{days} days'],
  },
  'price.surge': {
    lane: 'economic',
    severity: 'info',
    cooldownDays: 60,
    titles: ['TBS prices up {pct} in a month', 'Growers smile as fruit prices climb to {price}/kg'],
    bodies: ['Mills are competing for fresh fruit bunches.'],
    effects: ['TBS {price}/kg'],
  },
  'price.slump': {
    lane: 'economic',
    severity: 'notice',
    cooldownDays: 60,
    titles: ['TBS prices down {pct} in a month', 'Fruit prices slide to {price}/kg'],
    bodies: ['Buyers cite weak export demand.'],
    effects: ['TBS {price}/kg'],
  },
  'estate.firstSale': {
    lane: 'economic',
    severity: 'info',
    cooldownDays: 99_999,
    titles: ['A new estate in {region} sells its first harvest'],
    bodies: ['{n} kg of fresh fruit bunches went through the Kopdes at {price}/kg.'],
    effects: [],
  },
};
