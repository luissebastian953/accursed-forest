import { expect, test, type Page } from '@playwright/test';

/** A CI runner renders in software: the crew takes minutes, not seconds. */
const SLOW = process.env['CI'] ? 4 : 1;

// `?tutorial` asks for the walkthrough on a URL that would otherwise skip it.
const URL = '/play.html?webgl&seed=42&fresh&turbo&debug&tutorial';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('sawit:disclaimer', '2'));
});

const tid = (page: Page, id: string) => page.getByTestId(id);

async function boot(page: Page): Promise<void> {
  await page.goto(URL);
  // The first load after a build parses the engine cold, and slowly in software.
  await expect(page.locator('canvas')).toBeVisible({ timeout: 30_000 * SLOW });
  await expect(tid(page, 'hud-cash')).toContainText('Rp', { timeout: 10_000 * SLOW });
  await page.waitForTimeout(2500);
}

async function step(page: Page, n: number): Promise<void> {
  await expect(tid(page, 'tutorial-pill')).toContainText(`Step ${n} of 17`, {
    timeout: 10_000 * SLOW,
  });
}

/** The pre-cleared Kopdes block sits under the screen centre; its pin takes the click. */
async function clickCentre(page: Page): Promise<void> {
  const box = (await page.locator('canvas').boundingBox())!;

  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2 - 6);
}

test.describe('the first-time walkthrough (GDD 8 panel 24a)', () => {
  test('@smoke can be skipped, and stays skipped for the browser', async ({ page }) => {
    await boot(page);
    await step(page, 1);
    await expect(tid(page, 'tutorial')).toHaveAttribute('data-step', 'placeKopdes');
    await tid(page, 'tutorial-skip').click();
    await expect(tid(page, 'tutorial')).toHaveCount(0);
    expect(await page.evaluate(() => localStorage.getItem('sawit:tutorial'))).toBe('1');
  });

  test('leads a first estate from the block to the shop, and then lets go', async ({ page }) => {
    test.setTimeout(150_000 * SLOW);
    await boot(page);

    // 1. The block, marked by the pin whose card is already open.
    await step(page, 1);
    await expect(tid(page, 'hud-marker').filter({ hasText: 'First step' })).toBeVisible();
    await clickCentre(page);

    // 2. The button, with the card over it. Revealing the button must scroll the
    // panel, never the page: a page dragged sideways is an aside that never slid.
    await step(page, 2);
    await expect(tid(page, 'tutorial-card')).toContainText('Build your Workshop');
    await page.waitForTimeout(600);
    expect(
      await page.evaluate(() =>
        [document.documentElement, document.body, document.querySelector('#app')!].map(
          (el) => el.scrollLeft,
        ),
      ),
    ).toEqual([0, 0, 0]);
    await tid(page, 'action-PlaceKopdes').click();

    // 3. The chop: the walkthrough has already opened the neighbour it chose.
    await step(page, 3);
    await expect(tid(page, 'block-phase')).toHaveText('Wild');
    await expect(tid(page, 'tutorial-card')).toContainText('Clear the land');
    await tid(page, 'action-ChopBlock').click();

    // 4. The crew, reported on the card; the clock runs on its own.
    await step(page, 4);
    await expect(tid(page, 'clearing-card')).toBeVisible();

    // The progress bar is a bar: a hair high and the card's full width.
    const gauge = (await tid(page, 'clearing-card').locator('.gauge').boundingBox())!;

    expect(gauge.height).toBeLessThan(16);
    expect(gauge.width).toBeGreaterThan(200);
    await expect(tid(page, 'tutorial-card')).toContainText('Workers are clearing');

    // 5 and 6. Stock and plant, once the land is bare.
    await step(page, 5);
    await expect(tid(page, 'block-phase')).toHaveText('Cleared');
    await tid(page, 'action-BuyBibit').click();
    await step(page, 6);
    await tid(page, 'action-PlantBlock-palm').click();

    // 7 to 10. The guide over the planted block, four cards on Next.
    await step(page, 7);
    await expect(tid(page, 'tutorial-card')).toContainText('Guide, 1 of 4');
    await tid(page, 'tutorial-next').click();
    await step(page, 8);
    await expect(tid(page, 'tutorial-card')).toContainText('Palm slots');
    await tid(page, 'tutorial-next').click();
    await step(page, 9);
    await expect(tid(page, 'tutorial-card')).toContainText('Harvest');
    await tid(page, 'tutorial-next').click();
    await step(page, 10);
    await expect(tid(page, 'tutorial-card')).toContainText('Auto-harvest');
    await expect(tid(page, 'tutorial-next')).toHaveText('Done');
    await tid(page, 'tutorial-next').click();

    // 11. Back to the Workshop: the panel closes and the pin's card reopens on it.
    await step(page, 11);
    await expect(tid(page, 'block-panel')).toHaveCount(0);

    const pin = tid(page, 'hud-marker').filter({ hasText: 'Visit your Workshop' });

    await expect(pin).toBeVisible();
    await pin.getByTestId('hud-marker-pin').click();

    // 12. The shop button, then the shop.
    await step(page, 12);
    await expect(tid(page, 'kopdes-report')).toBeVisible();
    await tid(page, 'action-OpenShop').click();

    // 13 to 17. Five shelves on Next, in the walkthrough's order rather than the shop's.
    await step(page, 13);
    await expect(tid(page, 'kopdes-shop')).toBeVisible();

    for (const [n, text] of [
      [13, 'Seedlings'],
      [14, 'Fertilizer'],
      [15, 'Sanitation crew'],
      [16, 'Trichoderma'],
      [17, 'Bug trap'],
    ] as const) {
      await step(page, n);
      await expect(tid(page, 'tutorial-card')).toContainText(text);
      await tid(page, 'tutorial-next').click();
    }

    // The finishing card, and the estate is the player's.
    await expect(tid(page, 'tutorial-complete')).toBeVisible();
    await tid(page, 'tutorial-finish').click();
    await expect(tid(page, 'tutorial')).toHaveCount(0);
    expect(await page.evaluate(() => localStorage.getItem('sawit:tutorial'))).toBe('1');
  });

  test('offers its way back when the player closes what it points at', async ({ page }) => {
    await boot(page);
    await clickCentre(page);
    await step(page, 2);
    await expect(tid(page, 'tutorial-card')).toBeVisible();

    // Close the panel: the card has nowhere to stand, so the pill offers to show it again.
    await tid(page, 'block-panel').getByRole('button', { name: 'Close' }).click();
    await expect(tid(page, 'tutorial-show')).toBeVisible();
    await tid(page, 'tutorial-show').click();
    await expect(tid(page, 'block-panel')).toBeVisible();
    await expect(tid(page, 'tutorial-show')).toHaveCount(0);
  });
});
