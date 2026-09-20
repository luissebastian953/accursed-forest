import type { NewsTemplate } from './types.ts';

export const STATEMENTS: Record<string, NewsTemplate> = {
  // ── The Palace ────────────────────────────────────────────────────────
  'macro.palmIsATree': {
    lane: 'government',
    severity: 'notice',
    cooldownDays: 200,
    titles: [
      'President Prerows: "palm is a tree, isn\'t it?"',
      'Palace says deforestation worries are overblown: "it is still a tree"',
    ],
    bodies: [
      'Speaking at the national planning meeting, the President said the country should plant more palm and stop apologising for it. Land agents in {region} took the hint before the speech had ended.',
    ],
    effects: ['Land and seedlings dearer', 'TBS up', 'The authorities look away'],
    chronicle: true,
  },
  'macro.twentyMillionHectares': {
    lane: 'government',
    severity: 'warning',
    cooldownDays: 300,
    titles: [
      'Twenty million hectares opened for food and energy',
      'Forestry Minister Rajuli: the forest estate is "an asset, not an ornament"',
    ],
    bodies: [
      'Every crew in the province has been hired by somebody. Land that nobody wanted last year has three buyers this week.',
    ],
    effects: ['Land much dearer', 'Wages up'],
    chronicle: true,
  },
  'macro.watchTheMills': {
    lane: 'government',
    severity: 'info',
    cooldownDays: 120,
    titles: [
      'President orders mills watched over fruit prices',
      'Palace: "the smallholder must not be the one who loses"',
    ],
    bodies: ['The mills, watched, are paying better. Nobody expects this to last.'],
    effects: ['TBS up while the watching lasts'],
  },

  // ── The ministries ────────────────────────────────────────────────────
  'macro.ministerOrdersPriceUp': {
    lane: 'government',
    severity: 'info',
    cooldownDays: 60,
    titles: [
      'Agriculture Minister Amrun calls the fruit price "an anomaly"',
      'Minister gathers farmers and buyers, tells them the price goes back up',
    ],
    bodies: [
      'The rupiah is weak, which should lift an export crop. The minister, visibly puzzled, has instructed the price to rise by ten per cent.',
    ],
    effects: ['TBS up, briefly'],
  },
  'macro.fertiliserThroughCoop': {
    lane: 'economic',
    severity: 'info',
    cooldownDays: 150,
    titles: [
      'Village fund routed through the cooperatives',
      'Fertiliser to be distributed by Kopdes, ministry says',
    ],
    bodies: [
      "More than half of this year's village money must pass through the co-ops. For once, the shelf price falls.",
    ],
    effects: ['Kopdes prices down'],
  },
  'macro.coopTargetsCut': {
    lane: 'economic',
    severity: 'notice',
    cooldownDays: 150,
    titles: [
      'Cooperative targets halved, opening pushed back',
      'Half the promised co-ops will not open this year',
    ],
    bodies: [
      'The programme that was to hold down prices is now half the size it was announced at. Suppliers have adjusted.',
    ],
    effects: ['Kopdes prices up'],
  },

  // ── Enforcement ───────────────────────────────────────────────────────
  'macro.forestTaskForce': {
    lane: 'government',
    severity: 'warning',
    cooldownDays: 200,
    titles: [
      'Forest task force begins work in {region}',
      'Task force to "restore" plantations inside the forest estate',
    ],
    bodies: [
      'Satellite maps are being matched to land titles, district by district. Every estate is now interesting to somebody.',
    ],
    effects: ['Attention rises', 'The authorities forget more slowly'],
    chronicle: true,
  },
  'macro.agrinasTakesOver': {
    lane: 'government',
    severity: 'notice',
    cooldownDays: 240,
    titles: [
      'Seized estates handed to the state plantation company',
      'Millions of hectares change hands without changing crop',
    ],
    bodies: [
      'The land is still growing palm. It is simply growing it for somebody else now. With one buyer left in the district, land is cheap.',
    ],
    effects: ['Land cheaper'],
  },
  'macro.forestAmnesty': {
    lane: 'government',
    severity: 'notice',
    cooldownDays: 200,
    titles: [
      'Amnesty opens for plantations inside the forest estate',
      'Ministry offers to regularise what is already planted, for a fee',
    ],
    bodies: [
      'The office is processing paperwork quickly this season, and is receptive to being helped along.',
    ],
    effects: ['The coordination fee is half price'],
  },

  // ── The weather of money ──────────────────────────────────────────────
  'macro.rupiahAt18k': {
    lane: 'economic',
    severity: 'warning',
    cooldownDays: 120,
    titles: [
      'Rupiah touches 18,000 to the dollar',
      'Currency at a record low; exporters told to celebrate',
    ],
    bodies: [
      'An export crop earns more dollars and every imported input costs more rupiah. The estate is paid in one and buys in the other.',
    ],
    effects: ['TBS up', 'Everything in the shop up more'],
  },
  'macro.usTariffs': {
    lane: 'economic',
    severity: 'warning',
    cooldownDays: 120,
    titles: ['New tariffs hit Indonesian exports', 'Buyers abroad pause; the fruit price follows'],
    bodies: ['The tariff is on the shipment, but it is paid, as always, at the farm gate.'],
    effects: ['TBS down'],
  },
  'macro.eudrEnforcement': {
    lane: 'economic',
    severity: 'warning',
    cooldownDays: 240,
    titles: [
      'European deforestation rules begin to bite',
      'Buyers demand proof the land was not forest',
    ],
    bodies: [
      'Estates that kept their trees can prove where the fruit came from, and are paid for it. Estates that did not are selling to whoever is left.',
    ],
    effects: ['TBS down', 'Forest cover softens the blow'],
    chronicle: true,
  },

  // ── The sacking of Minister Purboy ────────────────────────────────────
  'macro.thePhoneCall': {
    lane: 'government',
    severity: 'warning',
    cooldownDays: 200,
    titles: [
      'Finance Minister Purboy removed mid-meeting',
      'Purboy takes a phone call, leaves the budget session, and is gone by lunch',
    ],
    bodies: [
      "He was presenting next year's budget when the call came. Two hours later the palace named his deputy. Nobody has explained anything, so the market has decided for itself.",
    ],
    effects: ['Shop prices up', 'TBS down'],
    chronicle: true,
  },
  'macro.cabinetLaughs': {
    lane: 'government',
    severity: 'notice',
    cooldownDays: 200,
    titles: [
      'Cabinet visibly relieved at the treasury change',
      'Colleagues photographed laughing on the palace steps',
    ],
    bodies: [
      'The man who asked where the money went has gone. Offices that were difficult last month are accommodating this month.',
    ],
    effects: ['The coordination fee is cheaper'],
  },
  'macro.integrityLeaves': {
    lane: 'government',
    severity: 'critical',
    cooldownDays: 9999,
    titles: [
      'The last man checking the invoices has left government',
      'Treasury reform abandoned; nobody is reading the returns',
    ],
    bodies: ['Every supplier in the province has quietly repriced. This one does not go back.'],
    effects: ['Input prices up, permanently'],
    chronicle: true,
  },
  'macro.goneFishing': {
    lane: 'government',
    severity: 'info',
    cooldownDays: 200,
    titles: [
      'Purboy photographed fishing, declines to comment',
      'Former minister on a boat, wondering what he did wrong',
    ],
    bodies: [
      'He has said nothing. For a month, remarkably, so has everyone else, and nothing at all happens to the price of anything.',
    ],
    effects: ['The country holds its breath'],
  },
  'macro.deputyTakesChair': {
    lane: 'economic',
    severity: 'notice',
    cooldownDays: 200,
    titles: [
      'Nazarra reverses the deposit shuffle',
      'New treasury pulls state money back from the banks',
    ],
    bodies: [
      'Credit tightens overnight. Land goes unsold, crews take what they are offered, and the shop puts its prices up anyway.',
    ],
    effects: ['Land cheaper', 'Wages down', 'Shop prices up'],
  },
  'macro.spouseLaments': {
    lane: 'government',
    severity: 'info',
    cooldownDays: 200,
    titles: [
      "The former minister's wife speaks, briefly",
      'A short statement from the Purboy household, and no accusation in it',
    ],
    bodies: [
      'She said she was sad for the country. It was three sentences long, and offices across the province have suddenly stopped taking certain calls.',
    ],
    effects: ['The coordination fee stops working'],
  },

  // ── Tech, which mostly does not matter ────────────────────────────────
  'macro.aiHype': {
    lane: 'economic',
    severity: 'info',
    cooldownDays: 60,
    titles: [
      'Minister announces national AI roadmap',
      'Every panel this week is about artificial intelligence',
    ],
    bodies: ['Nothing on the estate has changed. Everything costs slightly more anyway.'],
    effects: ['Shop prices up a little'],
  },
  'macro.aiLayoffs': {
    lane: 'economic',
    severity: 'notice',
    cooldownDays: 150,
    titles: [
      'Offices cut staff, blaming automation',
      'Call centres and banks shed thousands; the villages fill up again',
    ],
    bodies: [
      'The sons and daughters who left for city work are back, and looking. There has not been labour this cheap in years.',
    ],
    effects: ['Wages down'],
  },
  'macro.chipInEveryAppliance': {
    lane: 'economic',
    severity: 'info',
    cooldownDays: 200,
    titles: [
      'Pumps and sprayers now ship with a subscription',
      'Every machine on the shelf has a model inside it',
    ],
    bodies: ['Nobody asked for this. The price has gone up and stayed up.'],
    effects: ['Input prices up slightly, permanently'],
  },
  'macro.dataCentre': {
    lane: 'economic',
    severity: 'notice',
    cooldownDays: 200,
    titles: [
      'Data centre announced near the provincial grid',
      'Land near the substation bought quietly, then all at once',
    ],
    bodies: ['Nobody in {region} knows who is buying. Everybody knows what it costs now.'],
    effects: ['Land dearer'],
  },
  'macro.yieldApp': {
    lane: 'economic',
    severity: 'info',
    cooldownDays: 200,
    titles: [
      'Cooperative hands out a harvest advisor app',
      'The co-op is now recommending when to pick',
    ],
    bodies: ['It is right slightly more often than the foreman, which nobody says out loud.'],
    effects: ['Yields up a little'],
  },

  // ── The free meals programme ──────────────────────────────────────────
  'macro.fiftyThousandStudents': {
    lane: 'government',
    severity: 'critical',
    cooldownDays: 120,
    titles: [
      'Fifty thousand students poisoned by the meals programme this year',
      'Six mass poisonings in three days across four provinces',
    ],
    bodies: [
      'Kitchens have been suspended nationwide and their suppliers with them. Cooking oil demand has fallen off a cliff, and inspectors are looking for somebody to blame.',
    ],
    effects: ['TBS down', 'Attention rises'],
    chronicle: true,
  },
  'macro.kitchensNeverInspected': {
    lane: 'government',
    severity: 'warning',
    cooldownDays: 200,
    titles: [
      'Inspectors find kitchens were never inspected',
      'Raw food stored warm, no handwashing, staff without gloves',
    ],
    bodies: [
      'A hundred and sixty officers went looking. Every supplier in the country is now buying thermometers, gloves and cold storage, and passing on the cost.',
    ],
    effects: ['Shop prices up'],
  },
  'macro.coopBecomesKitchen': {
    lane: 'economic',
    severity: 'notice',
    cooldownDays: 200,
    titles: [
      'Cooperatives told to supply the meal kitchens',
      'Your Kopdes is now a kitchen, by government order',
    ],
    bodies: [
      'The contract pays daily and on time. It also pays better than you do, and your crew has noticed.',
    ],
    effects: ['A daily payment, if you have a Kopdes', 'Wages up'],
  },
  'macro.budgetEatsSubsidy': {
    lane: 'economic',
    severity: 'critical',
    cooldownDays: 9999,
    titles: [
      'Fertiliser subsidy cut to fund the meals programme',
      'Budget rebalanced; the estate pays for lunch',
    ],
    bodies: ['The subsidy is not coming back. Neither are the old prices.'],
    effects: ['Input prices up, permanently'],
    chronicle: true,
  },
  'macro.blameTheChillies': {
    lane: 'government',
    severity: 'info',
    cooldownDays: 90,
    titles: ['Minister blames the chillies', 'Official explanation: "the sambal, most likely"'],
    bodies: [
      'The programme is not mentioned. Suppliers put their prices up for a fortnight, on principle.',
    ],
    effects: ['Shop prices up a little'],
  },

  // ── Mulyonows in Osaka, and what is under it ──────────────────────────
  'macro.osakaCulvert': {
    lane: 'government',
    severity: 'info',
    cooldownDays: 9999,
    titles: [
      'Former president Mulyonows on holiday in Osaka',
      'Asked when the next song is coming, Mulyonows answers in Japanese',
    ],
    bodies: [
      '"Yo shiranai, naze kiku ndesu ka, kono watashi." I do not know. Why ask me? The entire national press corps is now in Japan, and nobody is looking at your estate.',
    ],
    effects: ['The authorities are distracted'],
  },
  'macro.endlessCastle': {
    lane: 'government',
    severity: 'info',
    cooldownDays: 9999,
    titles: [
      'Mulyonows enters an Osaka culvert and does not come out',
      'Former president joins Tanjidoor against the demon king',
    ],
    bodies: [
      'He is reported to be in a castle with no floors that rearranges itself as you walk. The palace has declined to comment. The Japanese press is covering it as a cultural exchange. Nobody on earth is thinking about palm oil.',
    ],
    effects: ['Half the suspicion against you evaporates'],
    chronicle: true,
  },

  // ── What burning costs ────────────────────────────────────────────────
  // Written flat: the deck jokes about ministers, never about this.
  'macro.hazeSeason': {
    lane: 'natural',
    severity: 'warning',
    cooldownDays: 90,
    titles: [
      'Haze closes schools across {region}',
      'The sky over {region} has been the colour of weak tea for a week',
    ],
    bodies: [
      'Visibility is down to a few hundred metres. Crews are working short days and the fruit is coming in light.',
    ],
    effects: ['Yields down while it sits'],
    chronicle: true,
  },
  'macro.animalsGone': {
    lane: 'natural',
    severity: 'warning',
    cooldownDays: 200,
    titles: [
      'Wildlife counts collapse after the burn season',
      'Surveyors find nothing moving in the burned blocks',
    ],
    bodies: [
      'Nothing has crossed the estate in weeks. The capybara, the macaques, the pangolin: all of it has gone somewhere else, or nowhere.',
    ],
    effects: ['No wildlife on the estate'],
    chronicle: true,
  },
  'macro.onTheBrink': {
    lane: 'natural',
    severity: 'critical',
    cooldownDays: 200,
    titles: [
      'District species listed as critically endangered',
      'What is left of the forest in {region} will not hold a population',
    ],
    bodies: [
      'There is almost no cover left in the district. Buyers who ask where their oil comes from have started asking.',
    ],
    effects: ['Attention rises', 'TBS down'],
    chronicle: true,
  },
  'macro.burnedCarcasses': {
    lane: 'natural',
    severity: 'critical',
    cooldownDays: 200,
    titles: [
      'Photographs from the fire line reach the national press',
      'What the fire left behind, in pictures',
    ],
    bodies: [
      'The photographs are of animals. They were taken on the edge of the burn, in this province, and everyone has now seen them.',
    ],
    effects: ['Attention rises sharply', 'No wildlife on the estate'],
    chronicle: true,
  },

  // ── Nature ────────────────────────────────────────────────────────────
  'macro.krakatoaLeaves': {
    lane: 'natural',
    severity: 'critical',
    cooldownDays: 9999,
    titles: ['Krakatoa erupts, then begins to move', 'Seismologists: the volcano is leaving'],
    bodies: [
      'A sonar array picked up a voice from beneath it: "no hope country, better move." It is heading for Malaysia, and the ground has not stopped shaking since. Ash is falling across {region}, which will be very good for the soil, if anything is left standing on it.',
    ],
    effects: ['Ash fertilises every block', 'Slopes twice as likely to give way', 'TBS up'],
    chronicle: true,
  },
};
