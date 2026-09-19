import { expect, test } from '@playwright/test';

/**
 * Smoke test (GDD 10.2): boot the app on the WebGL 2 fallback path, prove the
 * scene actually renders, and prove the spike's weather uniforms are wired.
 *
 * `?webgl` forces the fallback because WebGPU is not available in headless CI
 * (GDD 6.4); `?spike` selects the spike over the game. The WebGPU path is
 * exercised by hand in a real browser.
 *
 * Note: the canvas cannot be read back with `drawImage`; the renderer runs
 * without `preserveDrawingBuffer`, so the backbuffer is empty by the time a 2D
 * context could sample it. Playwright's compositor-level screenshot is the
 * reliable way to see what was actually drawn.
 */
test.describe('art spike', () => {
  test('boots on the WebGL fallback and draws a non-trivial scene', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text());
    });
    page.on('pageerror', (error) => errors.push(error.message));

    await page.goto('/play.html?webgl&spike');

    const canvas = page.locator('canvas');
    await expect(canvas).toBeVisible();
    await expect
      .poll(async () => canvas.evaluate((el: HTMLCanvasElement) => el.width > 0), {
        timeout: 30_000,
      })
      .toBe(true);

    // Let the pop-in cascade finish (GDD 6.5: capped at 300 ms + a 400 ms pop).
    await page.waitForTimeout(1500);

    // A flat frame compresses to almost nothing; a rendered estate does not.
    const painted = await canvas.screenshot();
    expect(painted.byteLength).toBeGreaterThan(15_000);

    expect(errors).toEqual([]);
  });

  test('the haze slider visibly changes the frame', async ({ page }) => {
    await page.goto('/play.html?webgl&spike');
    await expect(page.locator('canvas')).toBeVisible();
    await page.waitForTimeout(1500);

    const clear = await page.locator('canvas').screenshot();

    await page.locator('#spike-haze').fill('1');
    await page.locator('#spike-haze').dispatchEvent('input');
    await page.waitForTimeout(500);

    const hazed = await page.locator('canvas').screenshot();
    expect(hazed.equals(clear)).toBe(false);
  });

  test('replant restarts the cascade without errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));

    await page.goto('/play.html?webgl&spike');
    await expect(page.locator('#spike-replant')).toBeVisible();
    await page.locator('#spike-replant').click();
    await page.waitForTimeout(800);

    expect(errors).toEqual([]);
  });
});
