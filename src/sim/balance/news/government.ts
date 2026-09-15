/**
 * Government lane (§3.7, §3.9): reactions, scandals, and the authorities'
 * letters. Whether a response does anything is the integrity stat's business;
 * the words give it away. `.hollow` variants publish under low integrity,
 * `.real` under high.
 */

import type { NewsTemplate } from './types.ts';

export const GOVERNMENT: Record<string, NewsTemplate> = {
  'gov.fireResponse.hollow': {
    lane: 'government',
    severity: 'info',
    cooldownDays: 60,
    titles: [
      'Palace promises task force on fires',
      'Governor blames the weather for the haze',
      'Ministry forms a committee to study the formation of a fire committee',
    ],
    bodies: [
      'Officials declined to name any company involved. A spokesman said the matter was being handled.',
    ],
    effects: [],
  },
  'gov.fireResponse.real': {
    lane: 'government',
    severity: 'warning',
    cooldownDays: 60,
    titles: [
      'Task force audits plantation permits in {region}',
      'Police name estates under investigation for burning',
    ],
    bodies: [
      'Investigators say satellite hotspot data will be matched to land titles. Enforcement, for once, looks real.',
    ],
    effects: ['Authorities are paying attention'],
  },
  'gov.floodRelief.hollow': {
    lane: 'government',
    severity: 'info',
    cooldownDays: 60,
    titles: [
      'Relief funds for flood victims "on their way", says ministry',
      'Governor tours flood zone by helicopter',
    ],
    bodies: [
      "Residents say they have seen no aid. An audit of last year's relief budget could not be located.",
    ],
    effects: [],
  },
  'gov.floodRelief.real': {
    lane: 'government',
    severity: 'info',
    cooldownDays: 60,
    titles: ['Flood relief reaches {region} within a week'],
    bodies: [
      'Aid convoys have arrived. Officials promise drainage works on the worst-hit riverbanks.',
    ],
    effects: [],
  },
  'gov.scandal': {
    lane: 'government',
    severity: 'warning',
    cooldownDays: 90,
    titles: [
      'Audit finds ministry officials took payments from plantation firms',
      'Minister resigns over permits-for-cash scandal',
      'Anti-graft agency raids the district office',
    ],
    bodies: [
      'A new team has been installed and promises that permits and burning bans will be enforced. Observers give it a season.',
    ],
    effects: ['Enforcement bites harder for a while'],
  },
  'authority.letter': {
    lane: 'government',
    severity: 'warning',
    cooldownDays: 30,
    titles: ['District office summons estate owners over land clearing in {region}'],
    bodies: [
      'Summons from the district office: cease land clearing pending review. The letter names {estate}.',
    ],
    effects: ['Clearing costs +50% while the letter stands'],
  },
  'authority.investigation.attention': {
    lane: 'government',
    severity: 'critical',
    cooldownDays: 30,
    titles: ['Police open investigation into land clearing at {estate}'],
    bodies: [
      'Officers have visited the estate. No chopping or burning is permitted until {until}. Fruit sales may continue.',
    ],
    effects: ['Chop and burn banned until {until}'],
  },
  'authority.investigation.wildfire': {
    lane: 'government',
    severity: 'critical',
    cooldownDays: 30,
    titles: [
      'Police open investigation into fires at {estate}',
      'Estate named as source of {region} wildfire',
    ],
    bodies: [
      'Hotspot data traced the fire to plantation land. No chopping or burning is permitted until {until}.',
    ],
    effects: ['Chop and burn banned until {until}', 'A second wildfire means arrest'],
  },
  'authority.investigation.protectedForest': {
    lane: 'government',
    severity: 'critical',
    cooldownDays: 30,
    titles: ['Fire at the edge of protected forest: police move on {estate}'],
    bodies: [
      'Burning next to hutan lindung is treated as a crime whatever the circumstances. The ban runs until {until}.',
    ],
    effects: ['Chop and burn banned until {until}'],
  },
  'authority.settled': {
    lane: 'government',
    chronicle: true,
    severity: 'notice',
    cooldownDays: 30,
    titles: [
      'Investigation into {estate} quietly dropped',
      'Police cite "insufficient evidence" in {region} fire case',
    ],
    bodies: [
      'Sources describe a "coordination fee" of {cost}. The case file could not be found this morning.',
    ],
    effects: ['Ban lifted', 'Attention eased — for now'],
  },
  'authority.closed': {
    lane: 'government',
    chronicle: true,
    severity: 'info',
    cooldownDays: 30,
    titles: ['Clearing ban on {estate} expires'],
    bodies: ['The two-year ban has run its course. Officials say they will keep watching.'],
    effects: ['Chopping and burning allowed again'],
  },
  'authority.arrested': {
    lane: 'government',
    severity: 'critical',
    cooldownDays: 0,
    titles: ['Estate owner arrested over {region} fires', 'SWAT team detains owner of {estate}'],
    bodies: ['Prosecutors say the letters were ignored and the fires were set on purpose.'],
    effects: ['Under arrest'],
  },
};
