import { expect, test, type Page } from '@playwright/test';

/**
 * The M1a smoke test (§9): boot on the WebGL fallback, select a block, chop
 * and plant it, speed through the immature phase, save, reload and continue.
 *
 * `?webgl` forces the fallback path CI can run; `?seed=42&fresh` makes the
 * world deterministic and ignores any save in this browser profile.
 */

const URL = '/?webgl&seed=42&fresh';

async function boot(page: Page): Promise<string[]> {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(URL);
  await expect(page.locator('canvas')).toBeVisible();
  await expect(page.getByTestId('hud-cash')).toContainText('Rp');
  // Give the first chunks time to arrive from the worker.
  await page.waitForTimeout(2500);
  return errors;
}

/**
 * Select the block under the screen centre. The camera starts centred on the
 * pre-cleared Kopdes block; its raised terrace projects a few pixels above the
 * ground-plane centre, so aim slightly high to stay on the top face.
 */
async function selectCentreBlock(page: Page): Promise<void> {
  const box = (await page.locator('canvas').boundingBox())!;
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2 - 6);
  await expect(page.getByTestId('block-panel')).toBeVisible();
}

/** Whatever block was selected, get it to `Cleared` — chopping if it is wild. */
async function ensureCleared(page: Page): Promise<void> {
  const phase = page.getByTestId('block-phase');
  if ((await phase.textContent())?.trim() === 'Wild') {
    await page.getByTestId('action-ChopBlock').click();
    await expect(phase).toContainText('Clearing');
    await page.getByTestId('speed-20').click();
    await expect(phase).toHaveText('Cleared', { timeout: 15_000 });
    await page.getByTestId('speed-1').click();
  }
  await expect(phase).toHaveText('Cleared');
}

test.describe('Sawit Simulator — M1a', () => {
  test('boots, ticks, and shows the estate', async ({ page }) => {
    const errors = await boot(page);
    await expect(page.getByTestId('hud-date')).toContainText('Year 1');

    const before = await page.getByTestId('hud-date').textContent();
    await page.waitForTimeout(1500);
    const after = await page.getByTestId('hud-date').textContent();
    expect(after).not.toBe(before);

    const painted = await page.locator('canvas').screenshot();
    expect(painted.byteLength).toBeGreaterThan(20_000);
    expect(errors).toEqual([]);
  });

  test('selecting a block opens the panel and the actions follow the sim’s rules', async ({
    page,
  }) => {
    await boot(page);
    await selectCentreBlock(page);

    const panel = page.getByTestId('block-panel');
    await expect(panel).toContainText(/Block \d+, \d+/);
    await expect(panel).toContainText(/Grassfield|Wild forest|Dry scrub|Hills|Riverbank/);

    // Planting is only ever enabled on cleared land; the reason is shown otherwise.
    const phase = (await page.getByTestId('block-phase').textContent())?.trim();
    const plant = page.getByTestId('action-PlantBlock-palm');
    if (phase === 'Cleared') {
      await expect(plant).toBeEnabled();
      await expect(page.getByTestId('action-PlaceKopdes')).toBeEnabled();
    } else {
      await expect(plant).toBeDisabled();
      await expect(panel).toContainText('Clear the block first.');
      await expect(page.getByTestId('action-ChopBlock')).toBeEnabled();
    }
  });

  test('chop if needed, plant, grow, save, reload, continue', async ({ page }) => {
    const errors = await boot(page);
    await selectCentreBlock(page);
    await ensureCleared(page);

    // Plant the cleared block and let it grow at 20×.
    await page.getByTestId('action-PlantBlock-palm').click();
    await expect(page.getByTestId('block-phase')).toHaveText('Planted');
    await page.getByTestId('speed-20').click();
    await expect(page.getByTestId('growth-progress')).toContainText(/\d+ \/ 180 growth-days/, {
      timeout: 10_000,
    });

    // Past the seedling threshold the panel reports the next one.
    await expect(page.getByTestId('growth-progress')).toContainText(/\/ 900 growth-days/, {
      timeout: 30_000,
    });
    await page.getByTestId('speed-0').click();

    const dateBefore = await page.getByTestId('hud-date').textContent();
    const cashBefore = await page.getByTestId('hud-cash').textContent();

    // Save from the menu, then reload without `fresh` so the save is honoured.
    await page.getByTestId('menu-button').click();
    await page.getByTestId('menu-save').click();
    await expect(page.getByTestId('toast')).toContainText('Saved');

    await page.goto('/?webgl');
    await expect(page.getByTestId('hud-cash')).toContainText('Rp');
    await expect(page.getByTestId('hud-date')).toHaveText(dateBefore!);
    await expect(page.getByTestId('hud-cash')).toHaveText(cashBefore!);

    // And it keeps ticking from there.
    await page.getByTestId('speed-20').click();
    await page.waitForTimeout(1000);
    expect(await page.getByTestId('hud-date').textContent()).not.toBe(dateBefore);

    expect(errors).toEqual([]);
  });

  test('keyboard: space pauses, escape closes the panel', async ({ page }) => {
    await boot(page);
    await page.keyboard.press(' ');
    const paused = await page.getByTestId('hud-date').textContent();
    await page.waitForTimeout(800);
    expect(await page.getByTestId('hud-date').textContent()).toBe(paused);

    await selectCentreBlock(page);
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('block-panel')).toHaveCount(0);
  });
});
