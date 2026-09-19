import type { AudioSettings } from './Audio.ts';

export const AUDIO_STORAGE_KEY = 'sawit:audio';

export const DEFAULT_AUDIO_SETTINGS: AudioSettings = { muted: false, volume: 0.7 };

/** The two calls this needs, so a test can hand in a plain map. */
export interface SettingsStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

function browserStore(): SettingsStore | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

export function loadAudioSettings(store: SettingsStore | null = browserStore()): AudioSettings {
  if (!store) return { ...DEFAULT_AUDIO_SETTINGS };
  try {
    const raw = store.getItem(AUDIO_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_AUDIO_SETTINGS };
    const parsed = JSON.parse(raw) as Partial<AudioSettings>;
    const volume = Number(parsed.volume);
    return {
      muted: parsed.muted === true,
      volume: Number.isFinite(volume)
        ? Math.max(0, Math.min(1, volume))
        : DEFAULT_AUDIO_SETTINGS.volume,
    };
  } catch {
    // Unreadable or malformed: the default is always safe to play.
    return { ...DEFAULT_AUDIO_SETTINGS };
  }
}

export function saveAudioSettings(
  settings: AudioSettings,
  store: SettingsStore | null = browserStore(),
): void {
  if (!store) return;
  try {
    store.setItem(AUDIO_STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Storage full or blocked: the setting holds for this visit and no longer.
  }
}
