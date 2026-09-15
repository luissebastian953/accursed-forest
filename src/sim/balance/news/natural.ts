/** Natural lane (§3.7): generated directly by the weather and the land. */

import type { NewsTemplate } from './types.ts';

export const NATURAL: Record<string, NewsTemplate> = {
  'haze.start': {
    lane: 'natural',
    severity: 'warning',
    cooldownDays: 30,
    titles: [
      'Haze index climbs past 300 in {region}; visibility under a kilometre',
      'Smoke from distant fires settles over {region}',
      'Schools in {region} move online as the haze thickens',
    ],
    bodies: [
      'Forecasters expect the haze to hang for about {days} days. Harvest crews are staying home across the province.',
      'Satellite images show hotspots upwind. Buyers are already paying less for fresh fruit bunches.',
    ],
    effects: ['Sun −30% for ~{days} days', 'TBS price drifts down'],
  },
  'ash.start': {
    lane: 'natural',
    severity: 'critical',
    cooldownDays: 60,
    titles: [
      'Volcano sends ash 15 km up; eight airports closed',
      'Ash falls on {region} after an eruption across the strait',
    ],
    bodies: [
      'Grey dust is settling on roofs and fronds. Estates across {region} have halted harvest for about {days} days.',
    ],
    effects: [
      'Harvest halted ~{days} days',
      'Young palms scorched',
      'Fertile soil for a season afterwards',
    ],
  },
  'flood.start': {
    lane: 'natural',
    severity: 'warning',
    cooldownDays: 30,
    titles: [
      'River bursts its banks in {region}',
      'Floodwater covers low estates along the river in {region}',
    ],
    bodies: [
      '{n} blocks of low ground are under water for about {days} days. Undrained blocks lose young palms first.',
    ],
    effects: ['{n} blocks flooded ~{days} days', 'Young palms drown', 'Fertilizer washed out'],
  },
  'drought.start': {
    lane: 'natural',
    severity: 'warning',
    cooldownDays: 90,
    titles: [
      'Weeks without rain: drought declared in {region}',
      'Wells run low as {region} enters drought',
    ],
    bodies: [
      'Unirrigated land is drying out. The fire service warns that debris piles will catch.',
    ],
    effects: ['Unirrigated land dries', 'Sparks can catch debris'],
  },
  'drought.end': {
    lane: 'natural',
    severity: 'info',
    cooldownDays: 30,
    titles: ['Rain returns to {region}; drought over', 'Heavy rain breaks the drought in {region}'],
    bodies: ['The first real rain in weeks has come. Farmers say it is late but welcome.'],
    effects: [],
  },
  'wildfire.start': {
    lane: 'natural',
    severity: 'critical',
    cooldownDays: 20,
    titles: [
      'Wildfire out of control in {region}',
      'Land-clearing fire in {region} jumps its boundaries',
      'Hotspots multiply across {region}; ASEAN transboundary alert raised',
    ],
    bodies: [
      'Fire crews say the blaze began on plantation land being cleared by burning. Smoke is expected to spread for weeks.',
    ],
    effects: ['Fire spreads into planted land', 'Smoke for weeks', 'Authorities act at once'],
  },
  landslide: {
    lane: 'natural',
    severity: 'warning',
    cooldownDays: 0,
    titles: [
      'Landslide on a hillside cleared of forest in {region}',
      'Slope gives way after heavy rain in {region}; palms buried',
    ],
    bodies: [
      'The slope at {block} came down in the rain, taking {n} palms with it. Local officials note the hill was stripped of forest.',
    ],
    effects: ['{n} palms lost', 'Debris dumped downhill'],
  },
  'plague.start': {
    lane: 'natural',
    severity: 'warning',
    cooldownDays: 60,
    titles: [
      'Pest outbreak reported on estates in {region}',
      'Beetles and stem rot spread on plantations in {region}',
    ],
    bodies: [
      'Growers blame debris left from clearing. The agriculture office recommends sanitation and traps.',
    ],
    effects: ['Spread doubles on plagued blocks'],
  },
  'regime.elNino': {
    lane: 'natural',
    severity: 'notice',
    cooldownDays: 300,
    titles: [
      'Forecasters declare an El Niño year',
      'Meteorology agency: El Niño conditions expected all year',
    ],
    bodies: [
      'A longer, harsher dry season is forecast. Fires will spread further and first harvests may come late.',
    ],
    effects: ['Drier dry season', 'Fire spreads further'],
  },
  'regime.laNina': {
    lane: 'natural',
    severity: 'notice',
    cooldownDays: 300,
    titles: ['A La Niña year ahead, forecasters say', 'Wet year forecast as La Niña takes hold'],
    bodies: ['Expect more rain, more floods on low ground, and more landslides on bare slopes.'],
    effects: ['Wetter wet season', 'Floods and landslides likelier'],
  },
};
