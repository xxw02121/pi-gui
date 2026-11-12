/*
 * The user's locale preference and how it becomes a concrete locale. "system"
 * follows the OS language on every launch; anything else is an id from the registry.
 *
 * Browser-safe: the renderer owns the preference and remembers it in this profile's
 * localStorage, next to the other renderer-only layout preferences.
 */
import { appLocaleIds, defaultLocale, matchSystemLocale, type AppLocale } from "./catalog";

export type LocalePreference = "system" | AppLocale;

/** "system" plus every registered locale, in registry order. */
export const localePreferences: readonly LocalePreference[] = ["system", ...appLocaleIds];

export const LOCALE_STORAGE_KEY = "pi-gui:locale";

/** Used when the profile has no saved choice. English stays selectable in Settings. */
export const defaultLocalePreference: LocalePreference = "zh-CN";

function readStartupLocale(): LocalePreference | undefined {
  const value = (globalThis as { __piStartupLocale?: unknown }).__piStartupLocale;
  return isLocalePreference(value) ? value : undefined;
}

export function isLocalePreference(value: unknown): value is LocalePreference {
  return typeof value === "string" && (localePreferences as readonly string[]).includes(value);
}

/**
 * The language tags the OS reports, most preferred first. `navigator.languages`
 * is the full list; `navigator.language` is the fallback on older shells.
 */
export function detectSystemLanguages(): readonly string[] {
  const language = typeof navigator === "undefined" ? undefined : navigator.language;
  const languages = typeof navigator === "undefined" ? undefined : navigator.languages;
  if (languages && languages.length > 0) {
    return languages;
  }
  return language ? [language] : [];
}

export function resolveLocale(
  preference: LocalePreference,
  systemLanguages: readonly string[],
): AppLocale {
  if (preference !== "system") {
    return preference;
  }
  for (const languageTag of systemLanguages) {
    const match = matchSystemLocale(languageTag);
    if (match) {
      return match;
    }
  }
  // An unregistered system language reads the default locale.
  return defaultLocale;
}

export function readStoredLocale(): LocalePreference {
  try {
    const raw = localStorage.getItem(LOCALE_STORAGE_KEY);
    if (isLocalePreference(raw)) return raw;
  } catch {
    // Reading preferences is best-effort; the product default still applies.
    return readStartupLocale() ?? defaultLocalePreference;
  }
  return readStartupLocale() ?? defaultLocalePreference;
}

export function writeStoredLocale(preference: LocalePreference): void {
  try {
    localStorage.setItem(LOCALE_STORAGE_KEY, preference);
  } catch {
    // The choice stays live for this window even if it cannot be saved.
  }
}
