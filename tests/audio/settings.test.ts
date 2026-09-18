import { describe, expect, it } from 'vitest';

import {
  AUDIO_STORAGE_KEY,
  DEFAULT_AUDIO_SETTINGS,
  loadAudioSettings,
  saveAudioSettings,
  type SettingsStore,
} from '@audio/settings';

/** A store that remembers, and one that refuses. */
function memory(seed: Record<string, string> = {}): SettingsStore & { data: Map<string, string> } {
  const data = new Map(Object.entries(seed));
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => void data.set(key, value),
  };
}
const broken: SettingsStore = {
  getItem: () => {
    throw new Error('storage off');
  },
  setItem: () => {
    throw new Error('storage off');
  },
};

describe('sound settings', () => {
  it('round-trip through storage', () => {
    const store = memory();
    saveAudioSettings({ muted: true, volume: 0.35 }, store);
    expect(store.data.has(AUDIO_STORAGE_KEY)).toBe(true);
    expect(loadAudioSettings(store)).toEqual({ muted: true, volume: 0.35 });
  });

  it('fall back to the default when there is nothing, or nonsense, saved', () => {
    expect(loadAudioSettings(memory())).toEqual(DEFAULT_AUDIO_SETTINGS);
    expect(loadAudioSettings(memory({ [AUDIO_STORAGE_KEY]: '{not json' }))).toEqual(
      DEFAULT_AUDIO_SETTINGS,
    );
    expect(loadAudioSettings(null)).toEqual(DEFAULT_AUDIO_SETTINGS);
  });

  it('clamp a volume that wandered, and only read muted as a real true', () => {
    const loud = memory({ [AUDIO_STORAGE_KEY]: JSON.stringify({ muted: 'yes', volume: 4 }) });
    expect(loadAudioSettings(loud)).toEqual({ muted: false, volume: 1 });
    const bad = memory({ [AUDIO_STORAGE_KEY]: JSON.stringify({ muted: true, volume: 'loud' }) });
    expect(loadAudioSettings(bad)).toEqual({ muted: true, volume: DEFAULT_AUDIO_SETTINGS.volume });
  });

  it('never throw when storage is off', () => {
    expect(() => saveAudioSettings(DEFAULT_AUDIO_SETTINGS, broken)).not.toThrow();
    expect(loadAudioSettings(broken)).toEqual(DEFAULT_AUDIO_SETTINGS);
  });
});
