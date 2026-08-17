export interface UserPreferences {
  // Cookie / Storage Consent
  enableCookiePersistence: boolean;
  cookieConsentDismissed: boolean;

  // Active Visual & Print Settings
  layerShadowDepth: number; // 0px to 16px (default: 4px)
  layerShadowOpacity: number; // 0.0 to 0.7 (default: 0.25)
  layerShadowColor: string; // default: '#000000'
  printWithShadows: boolean; // default: false (clean physical prints)

  // Active Defaults
  defaultUnit: 'in' | 'mm' | 'cm'; // default: 'in'
  defaultBridgeWidthMm: number; // default: 2.0

  // Backdrop & Tactile Paper Textures
  backdropTheme: 'drafting' | 'cutting_mat' | 'clean_gray';
  paperTexture: 'off' | 'smooth_bristol' | 'cold_press';
  textureStrengths: {
    smooth_bristol: number; // 0.05 to 1.0 (default: 0.35)
    cold_press: number;     // 0.05 to 1.0 (default: 0.50)
  };
}

export const DEFAULT_USER_PREFERENCES: UserPreferences = {
  enableCookiePersistence: false,
  cookieConsentDismissed: false,

  layerShadowDepth: 4,
  layerShadowOpacity: 0.25,
  layerShadowColor: '#000000',
  printWithShadows: false,

  defaultUnit: 'in',
  defaultBridgeWidthMm: 2.0,

  backdropTheme: 'drafting',
  paperTexture: 'off',
  textureStrengths: {
    smooth_bristol: 0.10,
    cold_press: 0.10,
  },
};

const STORAGE_KEY = 'cutup_user_preferences_v1';

/**
 * Loads preferences from localStorage if persistence is enabled.
 */
export function loadUserPreferences(): UserPreferences {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_USER_PREFERENCES;
    const parsed = JSON.parse(raw);
    return {
      ...DEFAULT_USER_PREFERENCES,
      ...parsed,
      textureStrengths: {
        ...DEFAULT_USER_PREFERENCES.textureStrengths,
        ...(parsed.textureStrengths || {}),
      },
    };
  } catch {
    return DEFAULT_USER_PREFERENCES;
  }
}

/**
 * Saves user preferences to localStorage if cookie persistence is enabled.
 */
export function saveUserPreferences(prefs: UserPreferences): void {
  try {
    if (prefs.enableCookiePersistence) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
    } else {
      // If user disabled persistence, preserve only the dismissed flag so prompt doesn't nag
      localStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    // Graceful fallback for private browsing / blocked storage
  }
}
