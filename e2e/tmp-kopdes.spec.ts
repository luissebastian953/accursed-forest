import { expect, test } from '@playwright/test';

test('kopdes levels', async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto('/workbench.html?webgl');
  await expect(page.locator('canvas')).toBeVisible();
  await page.waitForTimeout(2500);
  const box = (await page.locator('canvas').boundingBox())!;
  for (const level of [2, 4]) {
    await page.locator(`[data-subject="kopdes:${level}"]`).click();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: `test-results/kopdes-${level}.png`, clip: box });
  }
});
