import { describe, expect, it } from 'vitest';

import { ECONOMY } from '@sim/balance/prices.ts';
import { SPECIAL_ESTATES, specialEstate } from '@sim/balance/specialEstates.ts';
import { createSim, seedFromEstateCode } from '@sim/index.ts';

describe('the special estates (GDD 4.6)', () => {
  it('answers to its name however it is typed, and only to the whole name', () => {
    expect(specialEstate('Karhutla')).toBe('karhutla');
    expect(specialEstate('  NYAWIT! ')).toBe('nyawit');
    expect(specialEstate('pe-nya-wit')).toBe('penyawit');
    expect(specialEstate('Penyawit Handal')).toBeNull();
    expect(specialEstate('')).toBeNull();
    expect(specialEstate('constructor')).toBeNull();
  });

  it('karhutla starts in an El Niño year, with the district already watching', () => {
    const sim = createSim(seedFromEstateCode('Karhutla')!, { name: 'Karhutla' });

    expect(sim.state.weather.regime).toBe('elNino');
    expect(sim.state.society.attention).toBe(SPECIAL_ESTATES.karhutla.attention);
  });

  it('nyawit starts with the severance on top of the usual cash', () => {
    const sim = createSim(1, { name: 'nyawit' });

    expect(sim.state.economy.cash).toBe(ECONOMY.startingCash + SPECIAL_ESTATES.nyawit.cash);
    expect(sim.state.run.stats.lowestCash).toBe(sim.state.economy.cash);
  });

  it('penyawit starts with seedlings for a block and fertilizer in the shed', () => {
    const sim = createSim(1, { name: 'Penyawit' });

    expect(sim.state.inventory.bibit).toBe(SPECIAL_ESTATES.penyawit.bibit);
    expect(sim.state.inventory.fertilizer).toBe(SPECIAL_ESTATES.penyawit.fertilizer);
  });

  it('leaves every other name, and the world itself, as it was', () => {
    const plain = createSim(1, { name: 'Penyawit Handal' });
    const special = createSim(1, { name: 'Penyawit' });

    expect(plain.state.economy.cash).toBe(ECONOMY.startingCash);
    expect(plain.state.inventory.bibit).toBe(0);
    expect(plain.state.weather.regime).toBe('normal');
    expect(special.state.worldGen).toEqual(plain.state.worldGen);
  });
});
