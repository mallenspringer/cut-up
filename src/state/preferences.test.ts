import { describe, it, expect, beforeEach, vi } from 'vitest';
import { loadUserPreferences, saveUserPreferences, DEFAULT_USER_PREFERENCES, UserPreferences } from './preferences';

describe('User Preferences & Storage Manager', () => {
  let mockStorage: Record<string, string> = {};

  beforeEach(() => {
    mockStorage = {};
    const storageMock = {
      getItem: vi.fn((key: string) => mockStorage[key] || null),
      setItem: vi.fn((key: string, value: string) => {
        mockStorage[key] = value;
      }),
      removeItem: vi.fn((key: string) => {
        delete mockStorage[key];
      }),
      clear: vi.fn(() => {
        mockStorage = {};
      }),
    };

    vi.stubGlobal('localStorage', storageMock);
  });

  it('1. Returns default preferences when storage is empty', () => {
    const prefs = loadUserPreferences();
    expect(prefs.layerShadowDepth).toBe(4);
    expect(prefs.layerShadowOpacity).toBe(0.25);
    expect(prefs.enableCookiePersistence).toBe(false);
    expect(prefs.cookieConsentDismissed).toBe(false);
    expect(prefs.printWithMargins).toBe(true);
    expect(prefs.paperTexture).toBe('off');
    expect(prefs.textureStrengths.smooth_bristol).toBe(0.10);
    expect(prefs.textureStrengths.cold_press).toBe(0.10);
  });

  it('2. Saves and loads preferences when persistence is enabled', () => {
    const customPrefs: UserPreferences = {
      ...DEFAULT_USER_PREFERENCES,
      enableCookiePersistence: true,
      cookieConsentDismissed: true,
      layerShadowDepth: 10,
      layerShadowOpacity: 0.5,
      defaultUnit: 'mm',
      paperTexture: 'cold_press',
      textureStrengths: {
        smooth_bristol: 0.6,
        cold_press: 0.85,
      },
    };

    saveUserPreferences(customPrefs);
    const loaded = loadUserPreferences();

    expect(loaded.enableCookiePersistence).toBe(true);
    expect(loaded.cookieConsentDismissed).toBe(true);
    expect(loaded.layerShadowDepth).toBe(10);
    expect(loaded.layerShadowOpacity).toBe(0.5);
    expect(loaded.defaultUnit).toBe('mm');
    expect(loaded.paperTexture).toBe('cold_press');
    expect(loaded.textureStrengths.smooth_bristol).toBe(0.6);
    expect(loaded.textureStrengths.cold_press).toBe(0.85);
  });

  it('3. Clears storage if user disables persistence', () => {
    const customPrefs: UserPreferences = {
      ...DEFAULT_USER_PREFERENCES,
      enableCookiePersistence: true,
      layerShadowDepth: 8,
    };
    saveUserPreferences(customPrefs);
    expect(mockStorage['cutup_user_preferences_v1']).toBeDefined();

    // Disable persistence
    saveUserPreferences({ ...customPrefs, enableCookiePersistence: false });
    expect(mockStorage['cutup_user_preferences_v1']).toBeUndefined();
  });
});
