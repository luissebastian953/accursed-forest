import { expect, test, type Page } from '@playwright/test';

/**
 * The browser smoke test (GDD 9, M1a + M1b): boot on the WebGL fallback, place
 * the Kopdes, stock bibit at the shop, chop and plant a neighbour, speed
 * through the immature years, harvest a ripe round and watch it sell, then
 * save, reload and continue.
 *
 * `?webgl` forces the fallback path CI can run; `?seed=42&fresh` makes the
 * world deterministic and ignores any save in this browser profile; `?turbo`
 * runs the clock twenty times faster than a player's, so years pass in seconds.
 */

const URL = '/play.html?webgl&seed=42&fresh&turbo&debug';

/** What `?debug` exposes on window; only the parts the suite touches. */
interface DebugWindow {
  __sawit: {
    sim: () => {
      state: {
        tick: number;
        worldGen: { kopdesBlock: number };
        kopdes: { blockId: number; level: number; autoHarvest: boolean } | null;
        society: {
          attention: number;
          integrity: number;
          investigationUntil: number;
          operatingBanUntil: number;
          news: { key: string }[];
        };
        economy: { cash: number };
        run: { ending?: string; endedAt?: number; insolventFor: number };
        blocks: Map<
          number,
          {
            id: number;
            owned: boolean;
            phase: string;
            slope: boolean;
            landslideAt: number;
            landslidePalms: number;
          }
        >;
        weather: {
          activeEvents: { id: string; startedAt: number; endsAt: number; blocks?: number[] }[];
        };
      };
      world: { toXY: (id: number) => [number, number] };
      gpu: () => { triangles: number };
      effects: () => { sparkleBurst: number };
    };
  };
}

const tid = (page: Page, id: string) => page.getByTestId(id);

/**
 * Level 3 is what opens the payroll and the 50x clock (GDD 3.3). The suite has
 * neither the years nor the cash to grow one, so it hands itself the level
 * through the debug hook, and the shop redraws on its next refresh.
 */
async function unlockKopdes(page: Page): Promise<void> {
  await page.evaluate(() => {
    const { state } = (window as unknown as DebugWindow).__sawit.sim();
    state.kopdes = state.kopdes
      ? Object.assign(state.kopdes, { level: 3 })
      : { blockId: state.worldGen.kopdesBlock, level: 3, autoHarvest: false };
  });
}

/**
 * 50x sits behind the same level. The suite skips years long before an estate
 * could grow one, so it hands itself the level too.
 */
async function unlockTurbo(page: Page): Promise<void> {
  await page.evaluate(() => {
    const { state } = (window as unknown as DebugWindow).__sawit.sim();
    if (state.kopdes) state.kopdes.level = 3;
    else state.kopdes = { blockId: state.worldGen.kopdesBlock, level: 3, autoHarvest: false };
  });
  await expect(tid(page, 'speed-50')).toBeEnabled();
}

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
    // Workers are hired here too, but not out of a shed: the payroll is shut
    // until the Kopdes is level 3, and says so.
    await expect(tid(page, 'shop-workers')).toBeVisible();
    await expect(tid(page, 'worker-sanitizer')).toBeDisabled();
    await expect(tid(page, 'worker-sanitizer')).toHaveAttribute('data-locked', 'kopdes');
    await tid(page, 'worker-sanitizer').hover();
    await expect(
      tid(page, 'tooltip').filter({ hasText: 'Unlock at Kopdes' }).first(),
    ).toContainText('3');

    await unlockKopdes(page);
    // ...and then a sanitizer goes on the payroll and comes off it.
    await expect(tid(page, 'worker-sanitizer')).toBeEnabled();
    await tid(page, 'worker-sanitizer').click();
    await expect(tid(page, 'worker-sanitizer')).toContainText('Dismiss');
    await tid(page, 'worker-sanitizer').click();
    await expect(tid(page, 'worker-sanitizer')).toContainText('Hire');
    await page.keyboard.press('Escape');
    await expect(tid(page, 'kopdes-shop')).toHaveCount(0);

    // Chop and plant a neighbour inside Kopdes range.
    await selectWildNeighbour(page);
    await tid(page, 'action-ChopBlock').click();
    await expect(tid(page, 'block-phase')).toContainText('Clearing');
    // The crew's progress ring stands over the block while it is worked.
    await expect(tid(page, 'work-marker').first()).toBeVisible();
    await expect(tid(page, 'work-marker').first()).toHaveAttribute('data-kind', 'chop');
    await unlockTurbo(page);
    await tid(page, 'speed-50').click();
    await expect(tid(page, 'block-phase')).toHaveText('Cleared', { timeout: 15_000 });
    await expect(tid(page, 'action-PlantBlock-palm')).toBeEnabled();
    await tid(page, 'action-PlantBlock-palm').click();
    await expect(tid(page, 'block-phase')).toHaveText('Planted');
    await expect(tid(page, 'block-range')).toContainText(/in range/i);
    await expect(tid(page, 'growth-progress')).toContainText(/\d+ \/ 110 growth-days/, {
      timeout: 10_000,
    });

    // ~540 growth-days at turbo speed, then the first ripe round.
    await expect(tid(page, 'harvest-info')).toContainText(/ripe now/i, { timeout: 60_000 });
    await tid(page, 'speed-0').click();
    await expect(tid(page, 'action-HarvestBlock')).toBeEnabled();
    const cashBeforeHarvest = await tid(page, 'hud-cash').textContent();
    await tid(page, 'action-HarvestBlock').click();
    await expect(tid(page, 'action-HarvestBlock')).toBeDisabled();
    // The rotation is a balance number; the unit tests pin it, this one only
    // asks that the panel says when the next round is.
    await expect(tid(page, 'block-panel')).toContainText(/Next round in \d+ days/);

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
    await tid(page, 'menu-button').click();
    await tid(page, 'menu-save').click();
    await expect(page.getByTestId('toast').filter({ hasText: 'Saved' })).toBeVisible();

    await page.goto('/play.html?webgl&turbo');
    await tid(page, 'start-continue').click();
    await expect(tid(page, 'hud-cash')).toContainText('Rp');
    // The clock is already running at 1× (two ticks a second under turbo), so
    // the date may have moved a few days by the time we read it: the save is
    // proven by landing within a fortnight of where we left, not to the day.
    await tid(page, 'speed-0').click();
    const days = (text: string | null): number => {
      const m = /Year (\d+), Day (\d+)/.exec(text ?? '');
      return m ? Number(m[1]) * 360 + Number(m[2]) : NaN;
    };
    const drift = days(await tid(page, 'hud-date').textContent()) - days(dateBefore);
    expect(drift).toBeGreaterThanOrEqual(0);
    expect(drift).toBeLessThan(15);
    // 50x is open here without asking again: the Kopdes level rode the save.
    await tid(page, 'speed-50').click();
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

  test('sound starts on the first click, and the menu switch sticks', async ({ page }) => {
    await boot(page);
    const audio = () =>
      page.evaluate(() => {
        const a = (
          window as unknown as {
            __sawit: { audio: { ready: boolean; getSettings(): { muted: boolean } } };
          }
        ).__sawit.audio;
        return { ready: a.ready, muted: a.getSettings().muted };
      });
    // Nothing until a gesture: browsers refuse to start a context on their own.
    expect((await audio()).ready).toBe(false);
    await tid(page, 'speed-0').click();
    expect(await audio()).toEqual({ ready: true, muted: false });

    // Off in the menu, and remembered for next time.
    await tid(page, 'menu-button').click();
    await expect(tid(page, 'menu-sound-label')).toHaveText('On');
    await expect(tid(page, 'menu-sound')).toHaveClass(/btn-green/);
    await tid(page, 'menu-sound').click();
    await expect(tid(page, 'menu-sound-label')).toHaveText('Off');
    await expect(tid(page, 'menu-sound')).toHaveClass(/btn-red/);
    expect((await audio()).muted).toBe(true);
    expect(
      await page.evaluate(() => JSON.parse(localStorage.getItem('sawit:audio') ?? '{}').muted),
    ).toBe(true);
    await page.keyboard.press('Escape');

    // The bar carries the same switch, and the two agree.
    await expect(tid(page, 'hud-sound')).toHaveClass(/btn-red/);
    await tid(page, 'hud-sound').click();
    await expect(tid(page, 'hud-sound')).toHaveClass(/btn-green/);
    expect((await audio()).muted).toBe(false);
    await tid(page, 'menu-button').click();
    await expect(tid(page, 'menu-sound-label')).toHaveText('On');
    await page.keyboard.press('Escape');
  });

  test('an estate can be named, and its name follows it into the bar', async ({ page }) => {
    test.setTimeout(90_000);
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    // No `fresh` and no `seed`: this is the title card a first-time player sees.
    await page.goto('/play.html?webgl&debug');
    await expect(page.locator('canvas')).toBeVisible();
    await page.waitForTimeout(2000);

    // The code under the boxes settles on the name as it is typed.
    await tid(page, 'start-name').fill('Penyawit Handal');
    const first = await tid(page, 'start-code-preview').textContent();
    expect(first).toMatch(/^[A-HJ-NP-Z2-9]{3}-[A-HJ-NP-Z2-9]{4}$/);
    // However it is written, it is the same estate.
    await tid(page, 'start-name').fill('penyawit handal');
    await expect(tid(page, 'start-code-preview')).toHaveText(first ?? '');
    // A different name is a different estate.
    await tid(page, 'start-name').fill('Kebun Sawit');
    await expect(tid(page, 'start-code-preview')).not.toHaveText(first ?? '');

    await tid(page, 'start-name').fill('Penyawit Handal');
    await tid(page, 'start-game').click();
    await page.waitForTimeout(2500);

    // The bar carries the name and the code it produced, and no renderer pill.
    await expect(tid(page, 'hud-estate-name')).toHaveText('Penyawit Handal');
    await expect(tid(page, 'hud-estate-code')).toHaveText(first ?? '');
    await expect(page.getByText('WEBGL', { exact: true })).toHaveCount(0);

    // And it survives a save and a reload.
    await tid(page, 'menu-button').click();
    await expect(tid(page, 'menu-estate-name')).toHaveText('Penyawit Handal');
    await expect(tid(page, 'menu-estate-code')).toHaveText(first ?? '');
    await tid(page, 'menu-save').click();
    await page.keyboard.press('Escape');
    await page.goto('/play.html?webgl&debug');
    await page.waitForTimeout(2500);
    await expect(tid(page, 'start-estate')).toContainText(first ?? '');
    expect(errors).toEqual([]);
  });

  test('pause stops the world: two frames a second apart are the same frame', async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto('/play.html?webgl&seed=42&fresh&debug');
    await expect(page.locator('canvas')).toBeVisible();
    await page.waitForTimeout(3000);
    const box = (await page.locator('canvas').boundingBox())!;
    // A patch of the estate with clouds over it, and the selection ring in it.
    const clip = { x: box.x, y: box.y + 220, width: 700, height: 420 };
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2 - 6);
    await expect(tid(page, 'block-panel')).toBeVisible();

    await tid(page, 'speed-1').click();
    await page.waitForTimeout(600);
    const runA = await page.screenshot({ clip });
    await page.waitForTimeout(1200);
    const runB = await page.screenshot({ clip });
    expect(runA.equals(runB), 'a running estate should be moving').toBe(false);

    await tid(page, 'speed-0').click();
    await page.waitForTimeout(900);
    const pauseA = await page.screenshot({ clip });
    await page.waitForTimeout(1500);
    const pauseB = await page.screenshot({ clip });
    expect(pauseA.equals(pauseB), 'a paused estate should be still').toBe(true);
  });

  test('the bar and the certificate agree on what is met', async ({ page }) => {
    await boot(page);
    // Far enough in for the bar to show progress, with a stale year record
    // behind it: the bar used to read that record rather than the estate.
    await page.evaluate(() => {
      const { state } = (window as unknown as DebugWindow).__sawit.sim();
      state.tick = 360 * 4;
      state.run.years.push({ conditionsMet: 0 } as never);
    });
    await page.waitForTimeout(600);
    const bar = (await tid(page, 'hud-ispo').textContent()) ?? '';
    await tid(page, 'hud-ispo').click();
    await expect(tid(page, 'certificate-panel')).toBeVisible();
    const modal = (await tid(page, 'certificate-count').textContent()) ?? '';
    expect(bar.match(/(\d)\s*\/\s*5/)?.[1]).toBe(modal.match(/(\d) of 5/)?.[1]);
  });

  test('New estate from the title card asks before it replaces the save', async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto('/play.html?webgl&debug');
    await expect(page.locator('canvas')).toBeVisible();
    await page.waitForTimeout(2500);
    await tid(page, 'start-name').fill('Penyawit Handal');
    await tid(page, 'start-game').click();
    await page.waitForTimeout(2500);
    await tid(page, 'menu-button').click();
    await tid(page, 'menu-save').click();
    await page.keyboard.press('Escape');

    // Back to the title card: the button opens the form, it does not act.
    await page.goto('/play.html?webgl&debug');
    await page.waitForTimeout(2800);
    await expect(tid(page, 'start-welcome')).toBeVisible();
    await tid(page, 'start-new').click();
    await expect(tid(page, 'menu')).toHaveAttribute('data-step', 'new');
    // It says what would be lost, and it opens on that estate's name.
    await expect(tid(page, 'menu-replace-warning')).toContainText('Penyawit Handal');
    await expect(tid(page, 'menu-name')).toHaveValue('Penyawit Handal');

    // Cancel means never mind: back to the card, save untouched.
    await tid(page, 'menu-new-cancel').click();
    await expect(tid(page, 'menu')).toHaveCount(0);
    await expect(tid(page, 'start-welcome')).toBeVisible();

    // And Create makes the named estate and starts playing it.
    await tid(page, 'start-new').click();
    await tid(page, 'menu-name').fill('Kebun Baru');
    await tid(page, 'menu-new-create').click();
    await page.waitForTimeout(2500);
    await expect(tid(page, 'start-screen')).toHaveCount(0);
    await expect(tid(page, 'hud-estate-name')).toHaveText('Kebun Baru');
  });

  test('a headline on the bar reads as words, not as its own key', async ({ page }) => {
    await boot(page);
    // Put the President's speech on the wire, the way the deck would.
    await page.evaluate(() => {
      const { state } = (window as unknown as DebugWindow).__sawit.sim();
      state.weather.activeEvents.push({
        id: 'macro:palmIsATree',
        startedAt: state.tick,
        endsAt: state.tick + 164,
      });
    });
    const chip = tid(page, 'event-chip-palmIsATree');
    await expect(chip).toBeVisible({ timeout: 5000 });
    await expect(chip).toContainText('Palm is a tree');
    // The failure this guards against printed the lookup key itself.
    await expect(page.getByText(/events\.\w+/)).toHaveCount(0);
  });

  test('upgrading the Kopdes changes the building, and is cheered', async ({ page }) => {
    test.setTimeout(90_000);
    await page.goto('/play.html?webgl&seed=42&fresh&debug');
    await expect(page.locator('canvas')).toBeVisible();
    await page.waitForTimeout(2000);
    await selectCentreBlock(page);
    await tid(page, 'action-PlaceKopdes').click();
    // The clock has to run: events reach the renderer on a tick, so a paused
    // estate would not hear about the upgrade until it started again.
    await page.evaluate(() => {
      (window as unknown as DebugWindow).__sawit.sim().state.economy.cash = 1e12;
    });
    await page.waitForTimeout(600);

    const glints = () =>
      page.evaluate(() => (window as unknown as DebugWindow).__sawit.effects().sparkleBurst);
    expect(await glints()).toBe(0);

    await tid(page, 'action-UpgradeKopdes').click();
    // One throw of glints over the new roof, and then it is over: this is a
    // moment, not a state the building sits in.
    await expect.poll(glints, { timeout: 5000 }).toBeGreaterThan(0);
    await expect.poll(glints, { timeout: 5000 }).toBe(0);
    await expect(tid(page, 'block-panel')).toContainText('Level 2');
  });

  test('the Kopdes can buy the authorities off, when they are buyable', async ({ page }) => {
    test.setTimeout(90_000);
    await page.goto('/play.html?webgl&seed=42&fresh&debug');
    await expect(page.locator('canvas')).toBeVisible();
    await page.waitForTimeout(2000);
    await selectCentreBlock(page);
    await tid(page, 'action-PlaceKopdes').click();

    // Nothing to settle: the envelope is not on the counter at all.
    await expect(tid(page, 'action-SettleInvestigation')).toHaveCount(0);

    // A case and a suspension, and an office honest enough to refuse.
    await page.evaluate(() => {
      const { state } = (window as unknown as DebugWindow).__sawit.sim();
      state.economy.cash = 1e12;
      state.society.integrity = 0.9;
      state.society.investigationUntil = state.tick + 80;
      state.society.operatingBanUntil = state.tick + 60;
    });
    await page.waitForTimeout(600);
    await expect(tid(page, 'action-SettleInvestigation')).toBeDisabled();
    await expect(tid(page, 'block-panel')).toContainText('taking calls');

    // A crooked office takes it, and both go.
    await page.evaluate(() => {
      (window as unknown as DebugWindow).__sawit.sim().state.society.integrity = 0.1;
    });
    await page.waitForTimeout(600);
    await tid(page, 'action-SettleInvestigation').click();
    const after = await page.evaluate(() => {
      const { state } = (window as unknown as DebugWindow).__sawit.sim();
      return {
        investigation: state.society.investigationUntil - state.tick,
        ban: state.society.operatingBanUntil - state.tick,
      };
    });
    expect(after.investigation).toBeLessThanOrEqual(0);
    expect(after.ban).toBeLessThanOrEqual(0);
  });

  test('a new estate takes two steps, and nothing else in the menu starts one', async ({
    page,
  }) => {
    test.setTimeout(90_000);
    await page.goto('/play.html?webgl&seed=42&fresh&debug');
    await expect(page.locator('canvas')).toBeVisible();
    await page.waitForTimeout(2000);
    const code = await tid(page, 'hud-estate-code').textContent();

    await tid(page, 'menu-button').click();
    // The menu's face carries no boxes: one button, and it only asks.
    await expect(tid(page, 'menu')).toHaveAttribute('data-step', 'default');
    await expect(tid(page, 'menu-name')).toHaveCount(0);
    await expect(tid(page, 'menu-new')).toContainText('Want to start a new game?');

    await tid(page, 'menu-new').click();
    await expect(tid(page, 'menu')).toHaveAttribute('data-step', 'new');
    // It says what would be lost, and cannot be run without a name.
    await expect(tid(page, 'menu-replace-warning')).toContainText(code ?? '');
    await expect(tid(page, 'menu-new-create')).toBeDisabled();
    await tid(page, 'menu-name').fill('Kebun Baru');
    await expect(tid(page, 'menu-new-create')).toBeEnabled();
    // The code the name would produce is shown before anything is replaced.
    const next = await tid(page, 'menu-code-preview').textContent();
    expect(next).toMatch(/^[A-HJ-NP-Z2-9]{3}-[A-HJ-NP-Z2-9]{4}$/);

    // Cancel goes back, and the estate in play is untouched.
    await tid(page, 'menu-new-cancel').click();
    await expect(tid(page, 'menu')).toHaveAttribute('data-step', 'default');
    await expect(tid(page, 'hud-estate-code')).toHaveText(code ?? '');

    // Dismissing from the form leaves the menu on its face, not mid-form.
    await tid(page, 'menu-new').click();
    await expect(tid(page, 'menu')).toHaveAttribute('data-step', 'new');
    await page.keyboard.press('Escape');
    await tid(page, 'menu-button').click();
    await expect(tid(page, 'menu')).toHaveAttribute('data-step', 'default');

    // Create is the one thing that replaces the estate.
    await tid(page, 'menu-new').click();
    await tid(page, 'menu-name').fill('Kebun Baru');
    await tid(page, 'menu-new-create').click();
    await page.waitForTimeout(1500);
    await expect(tid(page, 'hud-estate-name')).toHaveText('Kebun Baru');
    await expect(tid(page, 'hud-estate-code')).toHaveText(next ?? '');
  });

  test('50x is locked, with its reason, until the Kopdes reaches level 3', async ({ page }) => {
    await boot(page);

    const turbo = tid(page, 'speed-50');
    await expect(turbo).toBeDisabled();
    await expect(turbo).toHaveAttribute('data-locked', 'kopdes');
    // The button carries its own explanation, shown when the pointer rests on it.
    await turbo.hover();
    await expect(tid(page, 'tooltip').filter({ hasText: 'Unlock Kopdes' })).toContainText(
      'level 3',
    );
    // The keyboard cannot go round the lock either.
    const before = await tid(page, 'hud-date').textContent();
    await page.keyboard.press('3');
    await page.waitForTimeout(600);
    await expect(tid(page, 'speed-1')).toHaveClass(/btn-green/);

    await unlockTurbo(page);
    await expect(turbo).not.toHaveAttribute('data-locked', 'kopdes');
    await turbo.click();
    await expect(turbo).toHaveClass(/btn-green/);
    await expect(tid(page, 'hud-date')).not.toHaveText(before ?? '');
  });

  test('burning: a controlled burn caps the clock, a second one tips the wildfire', async ({
    page,
  }) => {
    test.setTimeout(90_000);
    const errors = await boot(page);

    // Into the dry season, so a shower does not rain the burn out.
    await unlockTurbo(page);
    await tid(page, 'speed-50').click();
    await expect(tid(page, 'hud-date')).toContainText(/Day (1[3-9]\d|2\d\d)/, { timeout: 30_000 });
    await tid(page, 'speed-1').click();

    await selectWildNeighbour(page);
    await expect(tid(page, 'burn-preview')).toContainText(/Could spread|Nothing next door/);
    // Hold the clock first: a medium burn is over in four days.
    await tid(page, 'speed-0').click();
    await tid(page, 'action-BurnBlock-2').click();

    await expect(tid(page, 'block-phase')).toContainText('Burning, medium');
    await expect(tid(page, 'fire-gauge')).toBeVisible();
    await expect(tid(page, 'burning-chip')).toBeVisible();
    // GDD 3.1.1: the clock is capped while anything burns; 10×, not a crawl.
    await expect(tid(page, 'speed-50')).toBeDisabled();
    await expect(tid(page, 'speed-10')).toBeEnabled();
    await expect(tid(page, 'wildfire-badge')).toHaveCount(0);

    // A second medium burn: pressure 6 > 5.5.
    await tid(page, 'speed-1').click();
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
    await page.goto('/play.html?webgl&seed=1&fresh&turbo&debug');
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
    await unlockTurbo(page);
    await tid(page, 'speed-50').click();
    await expect(tid(page, 'block-phase')).toHaveText('Cleared', { timeout: 20_000 });
    await tid(page, 'action-PlantBlock-palm').click();
    await expect(tid(page, 'block-phase')).toHaveText('Planted');

    const section = tid(page, 'pest-section');
    await expect(section).toBeVisible();
    await expect(page.locator('[data-testid^="slot-cell-"]')).toHaveCount(144);
    await expect(tid(page, 'action-SetTrap')).toBeDisabled();
    await expect(tid(page, 'action-SetTrap')).toHaveAttribute('title', /buy a kit at the Kopdes/);

    await tid(page, 'slot-cell-60').click();
    await expect(tid(page, 'slot-detail')).toContainText('Slot 6, 1');
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
    await page.goto('/play.html?webgl&seed=1&fresh&debug&turbo');
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
    await expect(tid(page, 'event-chip-haze')).toContainText(/Haze, \d+ d/);
    await expect(tid(page, 'event-chip-flood')).toContainText(`Flood: ${flooded} block`);
    await tid(page, 'speed-0').click();

    // Select a slope block: its panel explains the landslide risk.
    const hasSlope = await page.evaluate(() => {
      const { state } = (window as unknown as DebugWindow).__sawit.sim();
      return [...state.blocks.values()].some((b) => b.owned && b.slope);
    });
    expect(hasSlope).toBe(true);

    // A slide leaves a scar on the block, and the scar puts a pin over it.
    await page.evaluate(() => {
      const { state } = (window as unknown as DebugWindow).__sawit.sim();
      const block = state.blocks.get(state.worldGen.kopdesBlock)!;
      block.landslideAt = state.tick;
      block.landslidePalms = 144;
    });
    const scar = page.locator('[data-testid="hud-marker"][data-kind="landslide"]');
    await expect(scar).toHaveCount(1);
    await scar.getByTestId('hud-marker-alert').waitFor();
    await scar.hover();
    await expect(scar).toContainText('Landslide');
    await expect(scar).toContainText('144 palms lost');

    expect(errors).toEqual([]);
  });

  test('open land: saplings go in without a crew, and the Ministry halves what it holds', async ({
    page,
  }) => {
    test.setTimeout(90_000);
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto('/play.html?webgl&seed=42&fresh&debug&turbo');
    await expect(page.locator('canvas')).toBeVisible();
    await page.waitForTimeout(2000);

    await selectCentreBlock(page);
    await tid(page, 'action-PlaceKopdes').click();

    await selectWildNeighbour(page, /Grassfield|Dry scrub/);
    // Open land offers both futures side by side, the crew and the saplings.
    await expect(tid(page, 'block-panel')).toContainText('Clear this block');
    await expect(tid(page, 'block-panel')).toContainText('Or keep it forest');
    await expect(tid(page, 'action-ChopBlock')).toBeVisible();

    // Suspended, with the meter just under the line that summons a letter
    // card: the saplings buy half of both back.
    await page.evaluate(() => {
      const { state } = (window as unknown as DebugWindow).__sawit.sim();
      state.economy.cash = 1e9;
      state.society.attention = 38;
      state.society.operatingBanUntil = state.tick + 100;
    });
    // One press buys what the block is short of and plants it.
    await expect(tid(page, 'action-ReforestBlock')).toBeEnabled();
    await tid(page, 'action-ReforestBlock').click();
    await expect(tid(page, 'block-phase')).toHaveText('Reforesting');

    const after = await page.evaluate(() => {
      const { state } = (window as unknown as DebugWindow).__sawit.sim();
      return {
        attention: state.society.attention,
        left: state.society.operatingBanUntil - state.tick,
      };
    });
    expect(after.attention).toBeLessThan(20);
    expect(after.left).toBeLessThanOrEqual(50);
    expect(errors).toEqual([]);
  });

  test('news and the authorities: ticker, feed, letter, police, settle, arrest', async ({
    page,
  }) => {
    test.setTimeout(90_000);
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto('/play.html?webgl&seed=42&fresh&debug&turbo');
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

    // The ticker is there from day one, with nothing on it yet; a year at 50× fills it.
    await expect(tid(page, 'news-ticker')).toBeVisible();
    await unlockTurbo(page);
    await tid(page, 'speed-50').click();
    await expect(tid(page, 'news-ticker-latest')).toBeVisible({ timeout: 30_000 });
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
    // The card stops the clock; dismissing it starts the estate again.
    const dateOnCard = await tid(page, 'hud-date').textContent();
    await tid(page, 'card-dismiss').click();
    await expect(tid(page, 'attention-gauge')).toBeVisible();
    await expect(tid(page, 'hud-date')).not.toHaveText(dateOnCard!, { timeout: 5_000 });

    // The clock is running again after the letter, so the police arrive on their own.
    await setState(71, 500_000_000);
    await expect(tid(page, 'card-investigation')).toBeVisible({ timeout: 10_000 });
    await expect(tid(page, 'event-chip-investigation')).toBeVisible();
    await tid(page, 'card-settle').click();
    await expect(tid(page, 'card-investigation')).toHaveCount(0);
    await expect(tid(page, 'event-chip-investigation')).toHaveCount(0);

    await setState(100);
    await expect(page.locator('[data-testid="epilogue"][data-ending="arrested"]')).toBeVisible({
      timeout: 10_000,
    });
    await tid(page, 'epilogue-timeline-toggle').click();
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
    await page.goto('/play.html?webgl&seed=42&fresh&debug&turbo');
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
    await page.goto('/play.html?webgl&debug&turbo');
    await expect(page.locator('[data-testid="epilogue"][data-ending="clean"]')).toBeVisible({
      timeout: 15_000,
    });
    await expect(tid(page, 'epilogue-president')).toContainText('do the country a favour');
    await tid(page, 'epilogue-keep-playing').click();
    await expect(tid(page, 'epilogue')).toHaveCount(0);
    await unlockTurbo(page);
    await tid(page, 'speed-50').click();
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
