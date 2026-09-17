/**
 * The landing page (§ organic): static HTML that says what the game is, loads
 * no engine, and hands off to `play.html`. The game page paints its boot
 * shell before the engine arrives and takes it down once the app is up.
 */

import { expect, test } from '@playwright/test';

test.describe('landing page', () => {
  test('is real HTML with a title, a description and a Play link, and loads no engine', async ({
    page,
  }) => {
    const scripts: string[] = [];
    page.on('request', (r) => {
      if (r.resourceType() === 'script') scripts.push(r.url());
    });
    await page.goto('/');
    await expect(page).toHaveTitle(/Sawit Simulator/);
    await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', /estate/);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Sawit Simulator');
    await expect(page.getByTestId('play-link')).toBeVisible();
    // Nothing but the inline GA stub, which is a no-op without an id.
    expect(scripts.filter((u) => /three|index-|play-/.test(u))).toEqual([]);
  });

  test('Play opens the game: the boot shell paints first, then comes down', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('play-link').click();
    await expect(page).toHaveURL(/play\.html/);
    await expect(page.locator('canvas')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('boot')).toHaveCount(0);
  });
});
