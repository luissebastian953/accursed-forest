import { expect, test, type Page } from '@playwright/test';

const URL = '/workbench.html?webgl';

const tid = (page: Page, id: string) => page.getByTestId(id);
const subject = (page: Page, id: string) => page.locator(`[data-subject="${id}"]`);
const action = (page: Page, id: string) => page.locator(`[data-action="${id}"]`);

/** The renderer's own counters, as the panel prints them. */
async function stats(page: Page): Promise<Record<string, string>> {
  const cells = await tid(page, 'workbench-stats').locator('dt, dd').allTextContents();
  const out: Record<string, string> = {};

  for (let i = 0; i + 1 < cells.length; i += 2) out[cells[i]!.trim()] = cells[i + 1]!.trim();
  return out;
}

async function boot(page: Page): Promise<string[]> {
  const errors: string[] = [];

  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(URL);
  await expect(page.locator('canvas')).toBeVisible();
  await expect(tid(page, 'workbench-stats')).toBeVisible({ timeout: 20_000 });
  return errors;
}

test.describe('workbench', () => {
  test('is a development page: noindex, unlinked, and out of the sitemap', async ({ page }) => {
    await page.goto(URL);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
      'content',
      /noindex.*nofollow/,
    );

    // Neither landing page points at it, and neither does the sitemap.
    for (const path of ['/', '/id/']) {
      const html = await (await page.request.get(path)).text();

      expect(html).not.toContain('workbench.html');
    }

    const robots = await (await page.request.get('/robots.txt')).text();

    // No Disallow: a blocked crawler never reads the noindex it is there for.
    expect(robots).not.toContain('workbench');
  });

  test('offers the catalogue, and only the actions a subject implements', async ({ page }) => {
    const errors = await boot(page);

    await expect(tid(page, 'workbench-subject').first()).toBeVisible();

    const count = await tid(page, 'workbench-subject').count();

    expect(count).toBeGreaterThan(30);

    // A mesh has no behaviour: every button is dead, and says why.
    await subject(page, 'palm:mature').click();
    await expect(action(page, 'walk')).toBeDisabled();
    await action(page, 'walk').hover();
    await expect(tid(page, 'tooltip').filter({ hasText: 'no walk()' })).toBeVisible();

    // A mob has most of them; it still has nothing to burst.
    await subject(page, 'mob:orangutan').click();
    await expect(action(page, 'walk')).toBeEnabled();
    await expect(action(page, 'sit')).toBeEnabled();
    await expect(action(page, 'climb')).toBeEnabled();
    await expect(action(page, 'burst')).toBeDisabled();
    await action(page, 'walk').click();

    // An effect has the opposite pair.
    await subject(page, 'fx:coins').click();
    await expect(action(page, 'burst')).toBeEnabled();
    await expect(action(page, 'sleep')).toBeDisabled();
    await action(page, 'burst').click();

    // The filter narrows the catalogue.
    await tid(page, 'workbench-filter').fill('pangolin');
    await expect(tid(page, 'workbench-subject')).toHaveCount(1);

    expect(errors).toEqual([]);
  });

  test('changes the backdrop without touching the light on the subject', async ({ page }) => {
    const errors = await boot(page);
    const canvas = page.locator('canvas');

    await subject(page, 'fx:sparkles').click();

    const daylight = await canvas.screenshot();

    await page.locator('[data-backdrop="night"]').click();
    await expect.poll(async () => (await canvas.screenshot()).equals(daylight)).toBe(false);

    // Bloom is on by default here, because this is where emission is judged.
    await expect(tid(page, 'workbench-glow')).toHaveClass(/btn-green/);

    const glowing = await canvas.screenshot();

    await tid(page, 'workbench-glow').click();
    await expect(tid(page, 'workbench-glow')).not.toHaveClass(/btn-green/);
    await expect.poll(async () => (await canvas.screenshot()).equals(glowing)).toBe(false);

    expect(errors).toEqual([]);
  });

  test('gives back what it takes: subjects come and go without the GPU filling up', async ({
    page,
  }) => {
    test.setTimeout(90_000);

    const errors = await boot(page);

    await subject(page, 'mob:orangutan').click();
    await page.waitForTimeout(600);

    const before = await stats(page);

    // Ten changes of subject, across a mob, an effect and a tree.
    for (let i = 0; i < 5; i++) {
      await subject(page, 'fx:clouds').click();
      await subject(page, 'forest:rainforest').click();
      await subject(page, 'mob:orangutan').click();
    }

    await page.waitForTimeout(1200);

    const after = await stats(page);

    // The counters are the leak detector: they must land back where they were.
    expect(after['geometries']).toBe(before['geometries']);
    expect(after['textures']).toBe(before['textures']);
    expect(Number(after['gpu memory']!.replace(/[^\d.]/g, ''))).toBeLessThanOrEqual(
      Number(before['gpu memory']!.replace(/[^\d.]/g, '')) + 1,
    );

    expect(errors).toEqual([]);
  });
});
