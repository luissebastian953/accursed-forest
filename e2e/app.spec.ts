import { expect, test, type Page } from '@playwright/test';

/**
 * The browser smoke test (§9, M1a + M1b): boot on the WebGL fallback, place
 * the Kopdes, stock bibit at the shop, chop and plant a neighbour, speed
 * through the immature years, harvest a ripe round and watch it sell, then
 * save, reload and continue.
 *
 * `?webgl` forces the fallback path CI can run; `?seed=42&fresh` makes the
 * world deterministic and ignores any save in this browser profile.
 */

const URL = '/?webgl&seed=42&fresh';

/** What `?debug` exposes on window — only the parts the suite touches. */
interface DebugWindow {
  __sawit: {
    sim: () => {
      state: {
        tick: number;
        worldGen: { kopdesBlock: number };
        society: { attention: number; news: { key: string }[] };
        economy: { cash: number };
        run: { ending?: string; endedAt?: number; insolventFor: number };
        blocks: Map<number, { id: number; owned: boolean; phase: string; slope: boolean }>;
        weather: {
          activeEvents: { id: string; startedAt: number; endsAt: number; blocks?: number[] }[];
        };
      };
      world: { toXY: (id: number) => [number, number] };
    };
  };
}

const tid = (page: Page, id: string) => page.getByTestId(id);

async function boot(page: Page): Promise<string[]> {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(URL);
  await expect(page.locator('canvas')).toBeVisible();
  await expect(tid(page, 'hud-cash')).toContainText('Rp');
  // Give the first chunks time to arrive from the worker.
  await page.waitForTimeout(2500);
  return errors;
}

async function canvasCentre(page: Page): Promise<{ x: number; y: number }> {
  const box = (await page.locator('canvas').boundingBox())!;
  // The camera starts centred on the pre-cleared Kopdes block; its raised
  // terrace projects a few pixels above the ground-plane centre.
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 - 6 };
}

/** Select the block under the screen centre: the pre-cleared Kopdes block. */
async function selectCentreBlock(page: Page): Promise<void> {
  const c = await canvasCentre(page);
  await page.mouse.click(c.x, c.y);
  await expect(tid(page, 'block-panel')).toBeVisible();
}

/** Select a wild block next to the centre by probing screen offsets, optionally of one biome. */
async function selectWildNeighbour(page: Page, biome?: RegExp): Promise<void> {
  const c = await canvasCentre(page);
  const offsets: readonly (readonly [number, number])[] = [
    [78, 45],
    [-78, 45],
    [78, -45],
    [-78, -45],
    [156, 0],
    [-156, 0],
    [0, 90],
    [0, -90],
  ];
  for (const [dx, dy] of offsets) {
    await page.mouse.click(c.x + dx, c.y + dy);
    await page.waitForTimeout(150);
    const phase = (
      await tid(page, 'block-phase')
        .textContent()
        .catch(() => '')
    )?.trim();
    if (phase !== 'Wild') continue;
    if (biome && !biome.test((await tid(page, 'block-panel').textContent()) ?? '')) continue;
    return;
  }
  throw new Error(`no wild${biome ? ` ${biome.source}` : ''} neighbour found around the Kopdes`);
}

test.describe('Sawit Simulator', () => {
  test('boots, ticks, and shows the estate', async ({ page }) => {
    const errors = await boot(page);
    await expect(tid(page, 'hud-date')).toContainText('Year 1');
    await expect(tid(page, 'hud-price')).toContainText('/kg');

    const before = await tid(page, 'hud-date').textContent();
    await page.waitForTimeout(1500);
    expect(await tid(page, 'hud-date').textContent()).not.toBe(before);

    const painted = await page.locator('canvas').screenshot();
    expect(painted.byteLength).toBeGreaterThan(20_000);
    expect(errors).toEqual([]);
  });

  test('the block panel follows the sim’s rules and explains refusals', async ({ page }) => {
    await boot(page);
    await selectCentreBlock(page);
    await expect(tid(page, 'block-phase')).toHaveText('Cleared');
    // No stock yet: planting is disabled with the sim's own reason.
    await expect(tid(page, 'action-PlantBlock-palm')).toBeDisabled();
    await expect(tid(page, 'block-panel')).toContainText('Buy them at the Kopdes');
    await expect(tid(page, 'action-PlaceKopdes')).toBeEnabled();
  });

  test('the loop: Kopdes, shop, chop, plant, grow, harvest, sell, save, reload', async ({
    page,
  }) => {
    test.setTimeout(120_000);
    const errors = await boot(page);

    // Place the Kopdes and stock up.
    await selectCentreBlock(page);
    await tid(page, 'action-PlaceKopdes').click();
    await expect(tid(page, 'block-phase')).toHaveText('Kopdes');
    await tid(page, 'action-OpenShop').click();
    await expect(tid(page, 'kopdes-shop')).toBeVisible();
    await expect(tid(page, 'stock-bibit')).toHaveText('0');
    await tid(page, 'buy-bibit-144').click();
    await expect(tid(page, 'stock-bibit')).toHaveText('144');
    await tid(page, 'shop-tab-sell').click();
    await expect(tid(page, 'shop-price')).toContainText('/kg');
    await page.keyboard.press('Escape');
    await expect(tid(page, 'kopdes-shop')).toHaveCount(0);

    // Chop and plant a neighbour inside Kopdes range.
    await selectWildNeighbour(page);
    await tid(page, 'action-ChopBlock').click();
    await expect(tid(page, 'block-phase')).toContainText('Clearing');
    await tid(page, 'speed-20').click();
    await expect(tid(page, 'block-phase')).toHaveText('Cleared', { timeout: 15_000 });
    await expect(tid(page, 'action-PlantBlock-palm')).toBeEnabled();
    await tid(page, 'action-PlantBlock-palm').click();
    await expect(tid(page, 'block-phase')).toHaveText('Planted');
    await expect(tid(page, 'block-range')).toContainText('in range');
    await expect(tid(page, 'growth-progress')).toContainText(/\d+ \/ 180 growth-days/, {
      timeout: 10_000,
    });

    // ~900 growth-days at 40 ticks/s, then the first ripe round.
    await expect(tid(page, 'harvest-info')).toContainText('ripe now', { timeout: 60_000 });
    await tid(page, 'speed-0').click();
    await expect(tid(page, 'action-HarvestBlock')).toBeEnabled();
    const cashBeforeHarvest = await tid(page, 'hud-cash').textContent();
    await tid(page, 'action-HarvestBlock').click();
    await expect(tid(page, 'action-HarvestBlock')).toBeDisabled();
    await expect(tid(page, 'block-panel')).toContainText('Next round in 10 days');

    // Hand the picking to the Kopdes crew and take it back.
    await tid(page, 'toggle-auto-harvest').click();
    await expect(tid(page, 'toggle-auto-harvest')).toContainText('ON');
    await expect(tid(page, 'action-HarvestBlock')).toBeDisabled();
    await tid(page, 'toggle-auto-harvest').click();
    await expect(tid(page, 'toggle-auto-harvest')).toContainText('OFF');

    // The sale lands on the next tick.
    await tid(page, 'speed-1').click();
    await expect(page.getByTestId('toast').filter({ hasText: 'Sold' })).toBeVisible({
      timeout: 5_000,
    });
    await tid(page, 'speed-0').click();
    expect(await tid(page, 'hud-cash').textContent()).not.toBe(cashBeforeHarvest);

    // Save, reload without `fresh`, continue.
    const dateBefore = await tid(page, 'hud-date').textContent();
    const cashBefore = await tid(page, 'hud-cash').textContent();
    await tid(page, 'menu-button').click();
    await tid(page, 'menu-save').click();
    await expect(page.getByTestId('toast').filter({ hasText: 'Saved' })).toBeVisible();

    await page.goto('/?webgl');
    await expect(tid(page, 'hud-cash')).toContainText('Rp');
    await expect(tid(page, 'hud-date')).toHaveText(dateBefore!);
    await expect(tid(page, 'hud-cash')).toHaveText(cashBefore!);
    await tid(page, 'speed-20').click();
    await page.waitForTimeout(1000);
    expect(await tid(page, 'hud-date').textContent()).not.toBe(dateBefore);

    expect(errors).toEqual([]);
  });

  test('keyboard: space pauses, K opens the shop, H shows controls, escape closes things', async ({
    page,
  }) => {
    await boot(page);
    await page.keyboard.press(' ');
    const paused = await tid(page, 'hud-date').textContent();
    await page.waitForTimeout(800);
    expect(await tid(page, 'hud-date').textContent()).toBe(paused);

    await page.keyboard.press('k');
    await expect(tid(page, 'kopdes-shop')).toBeVisible();
    await expect(tid(page, 'kopdes-shop')).toContainText('No Kopdes yet');
    await page.keyboard.press('Escape');
    await expect(tid(page, 'kopdes-shop')).toHaveCount(0);

    await selectCentreBlock(page);
    await page.keyboard.press('Escape');
    await expect(tid(page, 'block-panel')).toHaveCount(0);

    // Controls: H and the top bar's ? button both toggle the popover.
    await page.keyboard.press('h');
    await expect(tid(page, 'controls-help')).toBeVisible();
    await expect(tid(page, 'controls-help')).toContainText('Pan the map');
    await page.keyboard.press('Escape');
    await expect(tid(page, 'controls-help')).toHaveCount(0);
    await tid(page, 'help-button').click();
    await expect(tid(page, 'controls-help')).toBeVisible();
    await tid(page, 'controls-help-close').click();
    await expect(tid(page, 'controls-help')).toHaveCount(0);
  });

  test('burning: a controlled burn caps the clock, a second one tips the wildfire', async ({
    page,
  }) => {
    test.setTimeout(90_000);
    const errors = await boot(page);

    // Into the dry season, so a shower does not rain the burn out.
    await tid(page, 'speed-20').click();
    await expect(tid(page, 'hud-date')).toContainText(/Day (1[3-9]\d|2\d\d)/, { timeout: 30_000 });
    await tid(page, 'speed-1').click();

    await selectWildNeighbour(page);
    await expect(tid(page, 'burn-preview')).toContainText(/Could spread|Nothing next door/);
    await tid(page, 'action-BurnBlock-2').click();

    await expect(tid(page, 'block-phase')).toContainText('Burning · medium');
    await expect(tid(page, 'fire-gauge')).toBeVisible();
    await expect(tid(page, 'burning-chip')).toBeVisible();
    // §3.1.1: the clock is capped while anything burns — 5×, not a crawl.
    await expect(tid(page, 'speed-20')).toBeDisabled();
    await expect(tid(page, 'speed-5')).toBeEnabled();
    await expect(tid(page, 'wildfire-badge')).toHaveCount(0);

    // A second medium burn: pressure 6 > 5.5.
    await page.keyboard.press('Escape');
    const c = await canvasCentre(page);
    const offsets: readonly (readonly [number, number])[] = [
      [-78, 45],
      [78, -45],
      [-78, -45],
      [156, 0],
      [-156, 0],
    ];
    let lit = false;
    for (const [dx, dy] of offsets) {
      await page.mouse.click(c.x + dx, c.y + dy);
      await page.waitForTimeout(150);
      const phase = (
        await tid(page, 'block-phase')
          .textContent()
          .catch(() => '')
      )?.trim();
      if (phase === 'Wild') {
        await tid(page, 'action-BurnBlock-2').click();
        lit = true;
        break;
      }
    }
    expect(lit).toBe(true);
    await expect(tid(page, 'wildfire-badge')).toBeVisible();
    await expect(
      page
        .getByTestId('toast')
        .filter({ hasText: /wildfire/i })
        .first(),
    ).toBeVisible();

    expect(errors).toEqual([]);
  });

  test('pests: the panel shows beetles, the slot grid, per-palm actions and the shop kits', async ({
    page,
  }) => {
    test.setTimeout(90_000);
    // Seed 1 starts in forest: the chopped neighbour comes with 55 debris.
    await page.goto('/?webgl&seed=1&fresh');
    await expect(page.locator('canvas')).toBeVisible();
    await expect(tid(page, 'hud-cash')).toContainText('Rp');
    await page.waitForTimeout(2500);

    await selectCentreBlock(page);
    await tid(page, 'action-PlaceKopdes').click();
    await tid(page, 'action-OpenShop').click();
    await expect(tid(page, 'buy-pheromoneTrap-1')).toBeVisible();
    await expect(tid(page, 'buy-metarhizium-1')).toBeVisible();
    await expect(tid(page, 'buy-trichoderma-1')).toBeVisible();
    await tid(page, 'buy-bibit-144').click();
    await page.keyboard.press('Escape');

    await selectWildNeighbour(page, /Wild forest/);
    await tid(page, 'action-ChopBlock').click();
    await tid(page, 'speed-20').click();
    await expect(tid(page, 'block-phase')).toHaveText('Cleared', { timeout: 20_000 });
    await tid(page, 'action-PlantBlock-palm').click();
    await expect(tid(page, 'block-phase')).toHaveText('Planted');

    const section = tid(page, 'pest-section');
    await expect(section).toBeVisible();
    await expect(page.locator('[data-testid^="slot-cell-"]')).toHaveCount(144);
    await expect(tid(page, 'action-SetTrap')).toBeDisabled();
    await expect(tid(page, 'action-SetTrap')).toHaveAttribute('title', /buy a kit at the Kopdes/);

    await tid(page, 'slot-cell-60').click();
    await expect(tid(page, 'slot-detail')).toContainText('Slot 5,0');
    await expect(tid(page, 'action-RemovePalm')).toBeEnabled();
    await tid(page, 'action-RemovePalm').click();
    await expect(tid(page, 'slot-detail')).toContainText('empty');
    await expect(tid(page, 'action-ReplantBlock')).toBeDisabled();
    await expect(tid(page, 'action-ReplantBlock')).toHaveAttribute('title', /Needs 1 bibit/);

    // Beetles breed in the debris if the block was not sanitized.
    await expect(tid(page, 'pest-beetles')).toContainText(/beetles:\s*[1-9]\d+\s*\//, {
      timeout: 30_000,
    });
    await tid(page, 'speed-0').click();
  });

  test('weather: forest cover in the HUD, haze and flood chips, slope risk on the panel', async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto('/?webgl&seed=1&fresh&debug');
    await expect(page.locator('canvas')).toBeVisible();
    await expect(tid(page, 'hud-forest')).toContainText('%');
    await page.waitForTimeout(2000);
    await tid(page, 'speed-0').click();

    // Raise haze and a flood over the blocks around the Kopdes through the debug hook.
    const flooded = await page.evaluate(() => {
      const { state, world } = (window as unknown as DebugWindow).__sawit.sim();
      const [kx, ky] = world.toXY(state.worldGen.kopdesBlock);
      const blocks = [...state.blocks.values()]
        .filter((b) => {
          const [x, y] = world.toXY(b.id);
          return b.owned && b.phase !== 'kopdes' && Math.abs(x - kx) + Math.abs(y - ky) <= 1;
        })
        .map((b) => b.id);
      state.weather.activeEvents.push({
        id: 'haze',
        startedAt: state.tick + 1,
        endsAt: state.tick + 30,
      });
      state.weather.activeEvents.push({
        id: 'flood',
        startedAt: state.tick + 1,
        endsAt: state.tick + 10,
        blocks,
      });
      return blocks.length;
    });
    expect(flooded).toBeGreaterThan(0);

    await tid(page, 'speed-1').click();
    await expect(tid(page, 'events-strip')).toBeVisible();
    await expect(tid(page, 'event-chip-haze')).toContainText(/Haze · \d+ d/);
    await expect(tid(page, 'event-chip-flood')).toContainText(`Flood · ${flooded} block`);
    await tid(page, 'speed-0').click();

    // Select a slope block: its panel explains the landslide risk.
    const hasSlope = await page.evaluate(() => {
      const { state } = (window as unknown as DebugWindow).__sawit.sim();
      return [...state.blocks.values()].some((b) => b.owned && b.slope);
    });
    expect(hasSlope).toBe(true);

    expect(errors).toEqual([]);
  });

  test('news and the authorities: ticker, feed, letter, police, settle, arrest', async ({
    page,
  }) => {
    test.setTimeout(90_000);
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto('/?webgl&seed=42&fresh&debug');
    await expect(page.locator('canvas')).toBeVisible();
    await page.waitForTimeout(2000);

    const setState = (attention: number, cash?: number) =>
      page.evaluate(
        ([a, c]) => {
          const { state } = (window as unknown as DebugWindow).__sawit.sim();
          state.society.attention = a as number;
          if (c !== null) state.economy.cash = c as number;
        },
        [attention, cash ?? null] as const,
      );

    // A year at 20× fills the feed.
    await tid(page, 'speed-20').click();
    await expect(tid(page, 'news-ticker')).toBeVisible({ timeout: 30_000 });
    await tid(page, 'speed-0').click();
    await page.keyboard.press('n');
    await expect(tid(page, 'news-panel')).toBeVisible();
    await expect(page.getByTestId('news-item').first()).toBeVisible();
    await tid(page, 'news-filter-economic').click();
    await page.keyboard.press('Escape');
    await expect(tid(page, 'news-panel')).toHaveCount(0);

    // No gauge until the first letter.
    await expect(tid(page, 'attention-gauge')).toHaveCount(0);
    await setState(41);
    await tid(page, 'speed-1').click();
    await expect(tid(page, 'card-letter')).toBeVisible({ timeout: 5_000 });
    await tid(page, 'card-dismiss').click();
    await expect(tid(page, 'attention-gauge')).toBeVisible();

    await setState(71, 500_000_000);
    await tid(page, 'speed-1').click();
    await expect(tid(page, 'card-investigation')).toBeVisible({ timeout: 5_000 });
    await expect(tid(page, 'event-chip-investigation')).toBeVisible();
    await tid(page, 'card-settle').click();
    await expect(tid(page, 'card-investigation')).toHaveCount(0);
    await expect(tid(page, 'event-chip-investigation')).toHaveCount(0);

    await setState(100);
    await tid(page, 'speed-1').click();
    await expect(page.locator('[data-testid="epilogue"][data-ending="arrested"]')).toBeVisible({
      timeout: 5_000,
    });
    await expect(page.locator('[data-testid="epilogue-timeline"] li').first()).toBeVisible();
    await expect(tid(page, 'epilogue-keep-playing')).toHaveCount(0);
    await tid(page, 'epilogue-new-estate').click();
    await expect(tid(page, 'epilogue')).toHaveCount(0);
    await expect(tid(page, 'hud-date')).toContainText('Year 1');

    expect(errors).toEqual([]);
  });

  test('endings: year-end card, bankruptcy, rewind, certificate and sandbox', async ({ page }) => {
    test.setTimeout(90_000);
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto('/?webgl&seed=42&fresh&debug');
    await expect(page.locator('canvas')).toBeVisible();
    await page.waitForTimeout(1500);

    // Close year 2 by jumping to its last days: a year-end card, a snapshot, the ISPO button.
    await page.evaluate(() => {
      const { state } = (window as unknown as DebugWindow).__sawit.sim();
      state.tick = 2 * 360 - 3;
    });
    await tid(page, 'speed-1').click();
    await expect(tid(page, 'year-end-card')).toBeVisible({ timeout: 10_000 });
    await expect(tid(page, 'year-end-card')).toContainText('Year 2 closed');
    await expect(tid(page, 'hud-ispo')).toBeVisible();
    await tid(page, 'hud-ispo').click();
    await expect(tid(page, 'certificate-panel')).toBeVisible();
    await expect(page.getByTestId(/^certificate-condition-/)).toHaveCount(5);
    await tid(page, 'certificate-close').click();

    // Deep in the red with nothing to lend against: the bank calls the loans.
    await page.evaluate(() => {
      const { state } = (window as unknown as DebugWindow).__sawit.sim();
      state.economy.cash = -1_000_000;
      state.run.insolventFor = 85;
    });
    await expect(tid(page, 'event-chip-insolvent')).toBeVisible({ timeout: 5_000 });
    await expect(page.locator('[data-testid="epilogue"][data-ending="bankrupt"]')).toBeVisible({
      timeout: 10_000,
    });
    await expect(tid(page, 'epilogue-keep-playing')).toHaveCount(0);

    // Rewind to the start of Year 3: same seed, cash back, the run alive.
    await tid(page, 'epilogue-rewind-3').click();
    await expect(tid(page, 'epilogue')).toHaveCount(0);
    await expect(tid(page, 'hud-date')).toContainText('Year 3');
    const after = await page.evaluate(() => {
      const { state } = (window as unknown as DebugWindow).__sawit.sim();
      return { ending: state.run.ending ?? null, cash: state.economy.cash };
    });
    expect(after.ending).toBeNull();
    expect(after.cash).toBeGreaterThan(0);

    // A certified estate: the ceremony, the epilogue, and sandbox.
    await page.evaluate(() => {
      const { state } = (window as unknown as DebugWindow).__sawit.sim();
      state.run.ending = 'clean';
      state.run.endedAt = state.tick;
    });
    // Leaving saves the estate; opening the game without a seed loads it, epilogue and all.
    await page.goto('/?webgl&debug');
    await expect(page.locator('[data-testid="epilogue"][data-ending="clean"]')).toBeVisible({
      timeout: 15_000,
    });
    await tid(page, 'epilogue-keep-playing').click();
    await expect(tid(page, 'epilogue')).toHaveCount(0);
    await tid(page, 'speed-20').click();
    const tickA = await page.evaluate(
      () => (window as unknown as DebugWindow).__sawit.sim().state.tick,
    );
    await page.waitForTimeout(800);
    const tickB = await page.evaluate(
      () => (window as unknown as DebugWindow).__sawit.sim().state.tick,
    );
    expect(tickB).toBeGreaterThan(tickA);

    expect(errors).toEqual([]);
  });
});
