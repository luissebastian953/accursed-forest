import { expect, test } from '@playwright/test';

/** A CI runner renders in software: it reaches a ripe round in minutes, not seconds. */
const SLOW = process.env['CI'] ? 4 : 1;

test.describe('landing page', () => {
  test('@smoke is real HTML with a title, a description and a Play link, and loads no engine', async ({
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

  test('@smoke carries what crawlers and social cards read: icons, Open Graph, JSON-LD', async ({
    page,
  }) => {
    await page.goto('/');
    await expect(page.locator('link[rel="icon"][type="image/png"]')).toHaveAttribute(
      'href',
      '/icon-32.png',
    );
    await expect(page.locator('link[rel="manifest"]')).toHaveAttribute('href', '/manifest.json');
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
      'BreadcrumbList',
      'WebPage',
    ]);
    // Nothing the build was supposed to fill in is still a placeholder.
    expect(ld ?? '').not.toMatch(/__[A-Z_]+__/);

    const game = graph.find((n) => n['@type'] === 'VideoGame') as unknown as {
      softwareVersion: string;
      browserRequirements: string;
      potentialAction: { target: { urlTemplate: string } };
    };

    expect(game.softwareVersion).toMatch(/^\d+\.\d+\.\d+/);
    expect(game.browserRequirements).toContain('WebGL');
    // The one action a visitor can take from the page, and it goes somewhere.
    expect(game.potentialAction.target.urlTemplate).toContain('/play.html');

    const play = await page.request.get('/play.html');

    expect(play.status()).toBe(200);

    // The assets the head points at actually exist.
    for (const path of ['/icon-32.png', '/icon-180.png', '/og-1200x630.png', '/manifest.json']) {
      const response = await page.request.get(path);

      expect(response.status(), path).toBe(200);
    }
  });

  test('@smoke describes the images it asks Google to index, on both pages', async ({ page }) => {
    for (const path of ['/', '/id/']) {
      await page.goto(path);

      // The hero is in the image sitemap (tools/seo.ts), so the page owes it a description.
      await expect(page.locator('.backdrop img'), path).toHaveAttribute('alt', /\S.{19,}/);
      await expect(page.locator('.backdrop'), path).not.toHaveAttribute('aria-hidden', 'true');

      for (const tag of ['meta[property="og:image:alt"]', 'meta[name="twitter:image:alt"]']) {
        await expect(page.locator(tag), `${path} ${tag}`).toHaveAttribute('content', /\S.{19,}/);
      }
    }
  });

  test('@smoke has an Indonesian twin that links both ways and carries its own FAQ schema', async ({
    page,
  }) => {
    await page.goto('/');

    // The English page is the original: it has a translation, it is not one.
    const enLd = (await page.locator('script[type="application/ld+json"]').textContent()) ?? '';

    expect(enLd).toContain('"workTranslation"');
    expect(enLd).not.toContain('"translationOfWork"');
    await page.getByRole('link', { name: 'Bahasa Indonesia' }).first().click();
    await expect(page).toHaveURL(/\/id\/$/);
    await expect(page.locator('html')).toHaveAttribute('lang', 'id');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Sawit Simulator');
    await expect(
      page
        .locator('h2, h3', { hasText: 'Kebakaran hutan' })
        .or(page.locator('b', { hasText: 'Kebakaran hutan' }))
        .first(),
    ).toBeVisible();

    const ld = await page.locator('script[type="application/ld+json"]').textContent();
    const graph = (JSON.parse(ld ?? '{}') as { '@graph': { '@type': string }[] })['@graph'];

    expect(graph.map((n) => n['@type'])).toContain('FAQPage');

    // The Indonesian page knows it is a translation, and says where it sits.
    const crumbs = graph.find((n) => n['@type'] === 'BreadcrumbList') as unknown as {
      itemListElement: { name: string }[];
    };

    expect(crumbs.itemListElement.map((c) => c.name)).toEqual([
      'Sawit Simulator',
      'Bahasa Indonesia',
    ]);

    const idPage = graph.find((n) => n['@type'] === 'WebPage') as unknown as {
      translationOfWork: { '@id': string };
    };

    expect(idPage.translationOfWork['@id']).toContain('#page');
    await page.getByRole('link', { name: 'English' }).first().click();
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  });

  test('the companion pages are real HTML in pairs, each with a heading, a canonical and its twin, and load no engine', async ({
    page,
  }) => {
    // Without an origin the build drops canonical and hreflang (vite.config.ts), on purpose.
    const origin = (process.env['VITE_SITE_URL'] ?? '').trim().replace(/\/+$/, '');
    const pairs: [string, string][] = [
      ['/guide/', '/id/panduan/'],
      ['/glossary/', '/id/istilah/'],
      ['/endings/', '/id/akhir-permainan/'],
      ['/accuracy/', '/id/akurasi/'],
      ['/guide/when-does-oil-palm-bear-fruit/', '/id/panduan/berapa-lama-sawit-berbuah/'],
      ['/guide/rhinoceros-beetle-oil-palm/', '/id/panduan/kumbang-tanduk-sawit/'],
      ['/guide/ganoderma-oil-palm/', '/id/panduan/ganoderma-kelapa-sawit/'],
      ['/guide/oil-palm-replanting-cost/', '/id/panduan/biaya-replanting-sawit/'],
      ['/guide/oil-palm-fertilizer-dose/', '/id/panduan/dosis-pupuk-sawit/'],
      ['/guide/oil-palm-spacing/', '/id/panduan/jarak-tanam-sawit/'],
    ];
    const scripts: string[] = [];

    page.on('request', (r) => {
      if (r.resourceType() === 'script') scripts.push(r.url());
    });

    for (const [en, id] of pairs) {
      for (const [path, twin, lang] of [
        [en, id, 'en'],
        [id, en, 'id'],
      ] as const) {
        const response = await page.goto(path);

        expect(response?.status(), path).toBe(200);
        await expect(page.locator('html'), path).toHaveAttribute('lang', lang);
        await expect(page.getByRole('heading', { level: 1 }), path).toHaveText(/\S{3,}/);
        await expect(page.getByTestId('play-link'), path).toBeVisible();
        await expect(page.locator('meta[name="description"]'), path).toHaveAttribute(
          'content',
          /\S.{59,}/,
        );
        // Every page links its twin, and the twin links back.
        // The first such link is the hidden language hint; the nav's is the visible one.
        await expect(page.locator(`a[href="${twin}"]:visible`).first(), path).toBeVisible();

        const canonical = page.locator('link[rel="canonical"]');
        const alternates = page.locator('link[rel="alternate"][hreflang]');

        if (origin) {
          await expect(canonical, path).toHaveAttribute('href', `${origin}${path}`);
          await expect(alternates.and(page.locator(`[hreflang="${lang}"]`)), path).toHaveAttribute(
            'href',
            `${origin}${path}`,
          );
          await expect(
            alternates.and(page.locator(`[hreflang="${lang === 'en' ? 'id' : 'en'}"]`)),
            path,
          ).toHaveAttribute('href', `${origin}${twin}`);
          await expect(
            alternates.and(page.locator('[hreflang="x-default"]')),
            path,
          ).toHaveAttribute('href', `${origin}${en}`);
        } else {
          await expect(canonical, path).toHaveCount(0);
          await expect(alternates, path).toHaveCount(0);
        }

        const ld = (await page.locator('script[type="application/ld+json"]').textContent()) ?? '';

        expect(ld, path).not.toMatch(/__[A-Z_]+__/);
        expect(ld, path).toContain(lang === 'en' ? '"workTranslation"' : '"translationOfWork"');
        expect(ld, path).not.toContain('FAQPage');
      }
    }

    expect(scripts.filter((u) => /three|index-|play-/.test(u))).toEqual([]);
  });

  test('@smoke Play opens the game: the boot shell paints first, then comes down', async ({
    page,
  }) => {
    await page.goto('/');
    await page.getByTestId('play-link').click();
    await expect(page).toHaveURL(/play\.html/);
    await expect(page.locator('canvas')).toBeVisible({ timeout: 30_000 * SLOW });
    await expect(page.getByTestId('boot')).toHaveCount(0);
    // The title screen sits over the estate.
    await expect(page.getByTestId('start-screen')).toBeVisible();
    await page.getByTestId('start-game').click();
    // Play opens the gate rather than the estate: the disclaimer stands
    // between them, over a title screen that has not gone anywhere yet.
    await expect(page.getByTestId('disclaimer-modal')).toBeVisible();
    await expect(page.getByTestId('start-screen')).toBeVisible();
    await page.getByTestId('disclaimer-accept').click();
    await expect(page.getByTestId('disclaimer-modal')).toHaveCount(0);
    await expect(page.getByTestId('start-screen')).toHaveCount(0, { timeout: 5_000 * SLOW });
    await expect(page.getByTestId('hud-date')).toContainText('Year 1');
    // The box was left unticked, so the gate was passed for this visit only.
    expect(await page.evaluate(() => localStorage.getItem('sawit:disclaimer'))).toBeNull();
  });

  test('the disclaimer only stops asking once the box is ticked', async ({ page }) => {
    await page.goto('/play.html?webgl');
    await expect(page.getByTestId('start-screen')).toBeVisible({ timeout: 30_000 * SLOW });
    await page.getByTestId('start-game').click();

    // The accuracy point ends in the one link the interface has, and it leaves
    // a run alone by opening a tab of its own.
    const link = page.getByTestId('disclaimer-point-link');

    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute('href', /dyslexia-assessment-test/);
    await expect(link).toHaveAttribute('target', '_blank');
    await page.getByTestId('disclaimer-hush').check();
    await page.getByTestId('disclaimer-accept').click();
    await expect(page.getByTestId('disclaimer-modal')).toHaveCount(0);
    expect(await page.evaluate(() => localStorage.getItem('sawit:disclaimer'))).toBe('2');

    await page.reload();
    await expect(page.getByTestId('start-screen')).toBeVisible({ timeout: 30_000 * SLOW });
    // A run was started above, so the second visit may be offered as Continue.
    await page.getByTestId('start-continue').or(page.getByTestId('start-game')).first().click();
    await expect(page.getByTestId('disclaimer-modal')).toHaveCount(0);
  });
});
