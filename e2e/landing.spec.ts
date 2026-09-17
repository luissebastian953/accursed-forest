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
    await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', /sawit/i);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Sawit Simulator');
    await expect(page.getByTestId('play-link')).toBeVisible();
    // Nothing but the inline GA stub, which is a no-op without an id.
    expect(scripts.filter((u) => /three|index-|play-/.test(u))).toEqual([]);
  });

  test('carries what crawlers and social cards read: icons, Open Graph, JSON-LD', async ({
    page,
  }) => {
    await page.goto('/');
    await expect(page.locator('link[rel="icon"][type="image/png"]')).toHaveAttribute(
      'href',
      '/icon-32.png',
    );
    await expect(page.locator('link[rel="manifest"]')).toHaveAttribute('href', '/site.webmanifest');
    await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
      'content',
      /og-1200x630\.png$/,
    );
    await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute(
      'content',
      'summary_large_image',
    );
    const ld = await page.locator('script[type="application/ld+json"]').textContent();
    const graph = (JSON.parse(ld ?? '{}') as { '@graph': { '@type': string }[] })['@graph'];
    expect(graph.map((n) => n['@type'])).toEqual([
      'VideoGame',
      'Organization',
      'WebSite',
      'FAQPage',
      'WebPage',
    ]);
    // The assets the head points at actually exist.
    for (const path of ['/icon-32.png', '/icon-180.png', '/og-1200x630.png', '/site.webmanifest']) {
      const response = await page.request.get(path);
      expect(response.status(), path).toBe(200);
    }
  });

  test('has an Indonesian twin that links both ways and carries its own FAQ schema', async ({
    page,
  }) => {
    await page.goto('/');
    await page.getByRole('link', { name: 'Bahasa Indonesia' }).first().click();
    await expect(page).toHaveURL(/\/id\/$/);
    await expect(page.locator('html')).toHaveAttribute('lang', 'id');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Sawit Simulator');
    await expect(
      page
        .locator('h2', { hasText: 'Kebakaran hutan' })
        .or(page.locator('b', { hasText: 'Kebakaran hutan' }))
        .first(),
    ).toBeVisible();
    const ld = await page.locator('script[type="application/ld+json"]').textContent();
    const graph = (JSON.parse(ld ?? '{}') as { '@graph': { '@type': string }[] })['@graph'];
    expect(graph.map((n) => n['@type'])).toContain('FAQPage');
    await page.getByRole('link', { name: 'English' }).first().click();
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  });

  test('Play opens the game: the boot shell paints first, then comes down', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('play-link').click();
    await expect(page).toHaveURL(/play\.html/);
    await expect(page.locator('canvas')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('boot')).toHaveCount(0);
    // The title screen sits over the estate; Start fades it and the HUD is live.
    await expect(page.getByTestId('start-screen')).toBeVisible();
    await page.getByTestId('start-game').click();
    await expect(page.getByTestId('start-screen')).toHaveCount(0, { timeout: 5_000 });
    await expect(page.getByTestId('hud-date')).toContainText('Year 1');
  });
});
