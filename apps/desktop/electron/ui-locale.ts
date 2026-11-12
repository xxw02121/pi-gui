import { appLocaleIds, type AppLocale } from "../src/i18n/catalog";
import { translatorFor, type TranslateParams } from "../src/i18n/translate";
import type { MessageKey } from "../src/i18n/catalog";

const listeners = new Set<() => void>();

function isAppLocale(value: string): value is AppLocale {
  return (appLocaleIds as readonly string[]).includes(value);
}

function localeFromEnv(): AppLocale | undefined {
  const raw = process.env.PI_APP_LOCALE?.trim();
  return raw && isAppLocale(raw) ? raw : undefined;
}

let currentLocale: AppLocale = localeFromEnv() ?? "zh-CN";

export function uiLocale(): AppLocale {
  return currentLocale;
}

export function onUiLocaleChanged(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function applyUiLocale(value: string): void {
  if (!isAppLocale(value) || value === currentLocale) return;
  currentLocale = value;
  for (const listener of listeners) listener();
}

export function uiText(key: MessageKey, params?: TranslateParams): string {
  return translatorFor(currentLocale)(key, params);
}
