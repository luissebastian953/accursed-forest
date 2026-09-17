/**
 * How a run ends, in the papers (§3.8): the operating ban, the certificate;
 * clean or bought; the fade, and the bank. Every one goes into the chronicle.
 */

import type { NewsTemplate } from './types.ts';

export const ENDINGS: Record<string, NewsTemplate> = {
  'authority.operatingBan': {
    lane: 'government',
    severity: 'critical',
    cooldownDays: 0,
    titles: [
      "Ministry suspends {estate}'s operating licence over burning",
      'New enforcement team shuts {estate} for two years',
    ],
    bodies: [
      'With the scandal still fresh, the new officials made an example. No clearing, palm planting or harvest until {until}.',
    ],
    effects: ['No clearing, palm planting or harvest until {until}', 'Upkeep continues at half'],
  },
  'authority.banLifted': {
    lane: 'government',
    severity: 'info',
    chronicle: true,
    cooldownDays: 0,
    titles: ['Operating licence restored to {estate}'],
    bodies: ['The suspension has run its course. Crews may return to the blocks.'],
    effects: ['Harvest and planting allowed again'],
  },
  'ispo.clean': {
    lane: 'government',
    severity: 'notice',
    chronicle: true,
    cooldownDays: 0,
    titles: ['{estate} named a model estate as ISPO certificate is issued'],
    bodies: [
      'Auditors found forest standing on the slopes and no fires in five years. Officials called it the standard others in {region} will be held to, and for once nobody laughed.',
    ],
    effects: ['ISPO certified'],
  },
  'ispo.dirty': {
    lane: 'government',
    severity: 'warning',
    chronicle: true,
    cooldownDays: 0,
    titles: ['Three ISPO certificates issued in {region} this week'],
    bodies: [
      '{estate} is among them. Asked about the burned hillsides, a ministry spokesman said the audit had been "comprehensive and final".',
    ],
    effects: ['ISPO certified'],
  },
  'ispo.dirtyHaze': {
    lane: 'natural',
    severity: 'warning',
    chronicle: true,
    cooldownDays: 0,
    titles: ['Haze season worst in a decade, say doctors in {region}'],
    bodies: ['Schools are closed again. Hotspot maps show clusters on certified plantation land.'],
    effects: [],
  },
  'ending.reboisasi': {
    lane: 'natural',
    severity: 'notice',
    chronicle: true,
    cooldownDays: 0,
    titles: ['{estate} has more forest than palms, and the birds have noticed'],
    bodies: [
      'The owner planted trees where the concession said oil palm, and kept planting. Officials in {region} have no form for it. The canopy has closed over the old clearings.',
    ],
    effects: ['Reboisasi'],
  },
  'ending.fade': {
    lane: 'economic',
    severity: 'notice',
    chronicle: true,
    cooldownDays: 0,
    titles: ["Twenty-five years on, {estate}'s first palms are too tall to harvest"],
    bodies: [
      'The estate survived every season {region} threw at it, and never won its certificate. Margins are thin and the old palms are due for replanting.',
    ],
    effects: ['The run has reached its horizon'],
  },
  'ending.bankrupt': {
    lane: 'economic',
    severity: 'critical',
    cooldownDays: 0,
    titles: ['Bank calls in the loans on {estate}', '{estate} declared bankrupt'],
    bodies: [
      'After {days} days in the red the creditors stopped waiting. The land goes to auction next month.',
    ],
    effects: ['Bankrupt'],
  },
  'ending.banned': {
    lane: 'government',
    severity: 'critical',
    cooldownDays: 0,
    titles: ['{estate} folds under operating ban'],
    bodies: [
      'With crews sent home and nothing to sell, {days} days in the red were enough. The licence will not need restoring.',
    ],
    effects: ['Bankrupt under the ban'],
  },
};
