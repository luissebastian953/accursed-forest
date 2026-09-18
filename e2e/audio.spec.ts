import { expect, test, type Page } from '@playwright/test';

/**
 * The estate's noises are synthesised, not recorded (`src/audio`), which means
 * they can be rendered offline and measured rather than listened to. Nobody
 * here can say whether the thunder sounds like thunder, but this suite can say
 * that it is audible, that it does not clip, and that its energy sits where a
 * roll of thunder's should.
 */

interface Measured {
  name: string;
  peak: number;
  rms: number;
  brightnessHz: number;
  audible: number;
}

/** Render every sound through an OfflineAudioContext and measure the samples. */
async function measureAll(page: Page): Promise<Measured[]> {
  await page.goto('/workbench.html?webgl');
  await expect(page.locator('canvas')).toBeVisible();
  await page.waitForFunction(() => '__bench' in window);
  return page.evaluate(async () => {
    // The workbench hands out the recipes; the built page has no module paths.
    const { ONE_SHOTS, LOOPS } = (
      window as unknown as {
        __bench: {
          ONE_SHOTS: Record<string, (c: BaseAudioContext, o: AudioNode, at: number) => number>;
          LOOPS: Record<string, (c: BaseAudioContext, o: AudioNode, at?: number) => unknown>;
        };
      }
    ).__bench;
    const out: Measured[] = [];
    const measure = (buffer: AudioBuffer, name: string): void => {
      const d = buffer.getChannelData(0);
      let peak = 0;
      let firstAt = -1;
      let lastAt = 0;
      for (let i = 0; i < d.length; i++) {
        const a = Math.abs(d[i]!);
        if (a > peak) peak = a;
        if (a > 0.002) {
          if (firstAt < 0) firstAt = i;
          lastAt = i;
        }
      }
      const from = firstAt < 0 ? 0 : firstAt;
      const span = Math.max(1, lastAt - from);
      let sum = 0;
      let crossings = 0;
      let last = 0;
      for (let i = from; i <= lastAt; i++) {
        const v = d[i]!;
        sum += v * v;
        if (v > 0 !== last > 0) crossings += 1;
        last = v;
      }
      out.push({
        name,
        peak,
        rms: Math.sqrt(sum / span),
        brightnessHz: Math.round((crossings / 2) * (buffer.sampleRate / span)),
        audible: (lastAt - from) / buffer.sampleRate,
      });
    };

    for (const [name, recipe] of Object.entries(ONE_SHOTS)) {
      const probe = new OfflineAudioContext(1, 48000 * 4, 48000);
      recipe(probe, probe.destination, 0);
      measure(await probe.startRendering(), name);
    }
    for (const [name, recipe] of Object.entries(LOOPS)) {
      const probe = new OfflineAudioContext(1, 48000 * 3, 48000);
      recipe(probe, probe.destination, 0);
      measure(await probe.startRendering(), name);
    }
    return out;
  });
}

test.describe('synthesised sound', () => {
  test('every sound makes a noise, and none of them clips', async ({ page }) => {
    const sounds = await measureAll(page);
    expect(sounds.length).toBeGreaterThanOrEqual(12);

    for (const sound of sounds) {
      // Silence is the failure that is easiest to ship without noticing.
      expect(sound.peak, `${sound.name} peak`).toBeGreaterThan(0.02);
      expect(sound.audible, `${sound.name} length`).toBeGreaterThan(0.03);
      // Past 1.0 the samples are squared off, which is heard as a buzz.
      expect(sound.peak, `${sound.name} clips`).toBeLessThanOrEqual(1);
      // And nothing should be so much louder than its neighbours that it
      // flattens them: the buses balance, they do not rescue.
      expect(sound.rms, `${sound.name} is too loud`).toBeLessThan(0.4);
    }
  });

  test('each one sits where its part of the estate should', async ({ page }) => {
    const sounds = await measureAll(page);
    const by = Object.fromEntries(sounds.map((s) => [s.name, s]));

    // Thunder and the excavator are felt more than heard; rain is all hiss.
    expect(by['thunder-near']!.brightnessHz).toBeLessThan(400);
    expect(by['excavator-engine']!.brightnessHz).toBeLessThan(400);
    expect(by['landslide']!.brightnessHz).toBeLessThan(400);
    expect(by['rain-light']!.brightnessHz).toBeGreaterThan(1200);
    expect(by['coins-burst']!.brightnessHz).toBeGreaterThan(800);

    // The big ones last; the UI gets out of the way.
    expect(by['landslide']!.audible).toBeGreaterThan(1.2);
    expect(by['ui-button-press']!.audible).toBeLessThan(0.2);
    expect(by['ui-button-denied']!.audible).toBeLessThan(0.3);
  });
});
