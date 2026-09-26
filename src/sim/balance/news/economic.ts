import type { NewsTemplate } from './types.ts';

export const ECONOMIC: Record<string, NewsTemplate> = {
  'macro.rupiahSlide': {
    lane: 'economic',
    severity: 'warning',
    cooldownDays: 30,
    titles: ['Rupiah slides against the dollar', 'Currency weakens; importers pass costs on'],
    bodies: [
      'Fertilizer and seedlings cost more from today. Palm oil is priced in dollars, so fruit prices rise too; but by less.',
    ],
    effects: ['Input prices ×{pct}', 'TBS price rises by half as much'],
  },
  'macro.fertilizerSpike': {
    lane: 'economic',
    severity: 'notice',
    cooldownDays: 30,
    titles: ['Fertilizer prices jump on supply shortage', 'Urea shortage pushes estate costs up'],
    bodies: ['Suppliers blame shipping. Workshop shelves show the new prices.'],
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
  'price.competition': {
    lane: 'economic',
    severity: 'notice',
    cooldownDays: 1,
    titles: [
      'Everyone is planting palm this year',
      'New smallholders crowd into palm across {region}',
    ],
    bodies: [
      'More growers means more fruit at the gate, and a buyer who no longer has to ask nicely. The bigger the Workshop, the bigger the crowd it stands in.',
    ],
    effects: ['TBS price {pct} of the opening price'],
  },
  'price.neighbours': {
    lane: 'economic',
    severity: 'warning',
    chronicle: true,
    cooldownDays: 1,
    titles: [
      'Neighbouring countries plant palm, and keep their forests',
      'Exports slip to growers who never cleared a hectare',
    ],
    bodies: [
      'They did it the careful way, with no deforestation to answer for, and the buyers noticed. Palm oil exportation is not working very well from here.',
    ],
    effects: ['TBS price {pct} of the opening price'],
  },
  'price.collapse': {
    lane: 'economic',
    severity: 'critical',
    chronicle: true,
    cooldownDays: 1,
    titles: ['Palm oil is becoming worthless', 'Estates around {region} close one by one'],
    bodies: [
      'There is more fruit than anyone wants to buy. The estates that borrowed to grow are the ones shutting their gates first.',
    ],
    effects: ['TBS price {pct} of the opening price'],
  },
  'estate.theft': {
    lane: 'economic',
    severity: 'warning',
    chronicle: true,
    cooldownDays: 15,
    titles: [
      'Fruit thieves hit {estate} overnight',
      'Ripe bunches stripped from {block} at {estate}',
    ],
    bodies: [
      'About {n} kg walked off the block before anyone noticed. A guard would have noticed.',
    ],
    effects: ['{n} kg of fruit gone'],
  },
  'estate.thiefCaught': {
    lane: 'economic',
    severity: 'notice',
    cooldownDays: 15,
    titles: ['Security at {estate} sees off a fruit thief'],
    bodies: ['The guard was on the ripe blocks when it mattered.'],
    effects: ['Nothing taken'],
  },
  'estate.babiNgepet': {
    lane: 'government',
    severity: 'warning',
    chronicle: true,
    cooldownDays: 30,
    titles: [
      'Villagers blame babi ngepet for missing cash at {estate}',
      'A pig that stood up: {estate} says its cash box is lighter',
    ],
    bodies: [
      'Staff swear the pig walked in on two legs. {cost} is gone either way, and the police have declined to open a file on a pig.',
    ],
    effects: ['{cost} taken'],
  },
  'estate.firstSale': {
    lane: 'economic',
    chronicle: true,
    severity: 'info',
    cooldownDays: 99_999,
    titles: ['A new estate in {region} sells its first harvest'],
    bodies: ['{n} kg of fresh fruit bunches went through the Workshop at {price}/kg.'],
    effects: [],
  },
};
