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
  'flood.regional': {
    lane: 'natural',
    severity: 'notice',
    cooldownDays: 30,
    titles: [
      'River bursts its banks downstream in {region}',
      'Floods cut roads in the lowlands of {region}',
    ],
    bodies: [
      'Villages along the river are under water for about {days} days. Your land sits above it this time.',
    ],
    effects: ['Not on your land this time'],
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
  'storm.lightning': {
    lane: 'natural',
    severity: 'warning',
    cooldownDays: 20,
    titles: [
      'Lightning sets plantation land alight in {region}',
      'Dry storm starts a fire near {estate}',
    ],
    bodies: [
      'A bolt found something that would burn. Nobody lit this one; which will not stop it spreading.',
    ],
    effects: ['A fire nobody lit'],
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
  'estate.animalBurned': {
    lane: 'natural',
    severity: 'warning',
    chronicle: true,
    cooldownDays: 20,
    titles: [
      'Wildlife burned alive in a land-clearing fire at {estate}',
      'Animals caught in the flames as {estate} burns its land',
    ],
    bodies: [
      'Whatever was living on {block} did not get out. A conservation group has asked the district for the estate’s burn records.',
    ],
    effects: ['Animals killed in the fire'],
  },
  'estate.haunting': {
    lane: 'natural',
    severity: 'warning',
    chronicle: true,
    cooldownDays: 360,
    titles: [
      'Workers at {estate} refuse the night shift: "the dead walk the rows"',
      'Ghost sightings spread across {estate}; palms planted over a mass grave, villagers say',
    ],
    bodies: [
      'The estate planted over an old mass grave at {block}, and now nobody will stay past dusk. Hired hands turn up late and leave early.',
    ],
    effects: ['Ghosts across the estate', 'Hired workers at half pace'],
  },
  'estate.hauntingDeep': {
    lane: 'natural',
    severity: 'critical',
    chronicle: true,
    cooldownDays: 360,
    titles: [
      'Fruit vanishes from every block at {estate}; crews blame the dead',
      '{estate} harvests short on every round, and nobody will say where the bunches go',
    ],
    bodies: [
      'Years after the grave at {block} was planted over, whole bunches go missing between the tree and the truck. The crew leaves offerings at the rows and picks less each round.',
    ],
    effects: ['Fruit missing from every harvest'],
  },
};
