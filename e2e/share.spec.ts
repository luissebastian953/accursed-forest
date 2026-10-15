import { expect, test } from '@playwright/test';

/** A CI runner renders in software: the game page takes longer to come up. */
const SLOW = process.env['CI'] ? 4 : 1;

test.describe('a shared estate', () => {
  test('the landing page carries the code into every Play link, and says so', async ({ page }) => {
    await page.goto('/?estate=abcdefg');
    await expect(page.getByTestId('estate-hint')).toBeVisible();
    await expect(page.getByTestId('estate-hint')).toContainText('ABC-DEFG');
    await expect(page.getByTestId('play-link')).toHaveAttribute(
      'href',
      '/play.html?estate=ABC-DEFG',
    );

    // Anything that is not a code leaves the page as it was.
    await page.goto('/?estate=<script>');
    await expect(page.getByTestId('estate-hint')).toBeHidden();
    await expect(page.getByTestId('play-link')).toHaveAttribute('href', '/play.html');
  });

  test('the game opens on the title with the code in the seed box, not in play', async ({
    page,
  }) => {
    await page.goto('/play.html?webgl&estate=ABC-DEFG');
    await expect(page.getByTestId('start-screen')).toBeVisible({ timeout: 30_000 * SLOW });
    await expect(page.getByTestId('start-code')).toHaveValue('ABC-DEFG');
    await expect(page.getByTestId('start-code-preview')).toHaveText('ABC-DEFG');
  });
});
