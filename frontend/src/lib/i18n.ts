import i18n from 'i18next';
import { initReactI18next, useTranslation } from 'react-i18next';
import { useCallback } from 'react';
import type { Language } from '@kitchentodoor/shared';
import en from '../locales/en.json';
import { transitionAppearance } from './appearanceTransition';

declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'ui';
    resources: typeof en;
    enableSelector: 'optimize';
  }
}

export const LANGUAGE_STORAGE_KEY = 'ktd_language';
const isLanguage = (value: unknown): value is Language => value === 'en' || value === 'ja';
function storedLanguage(): Language {
  try {
    const value = localStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (isLanguage(value)) return value;
  } catch {
    /* Browser storage can be unavailable. */
  }
  return 'en';
}

let japanese: Promise<void> | undefined;
async function loadLanguage(language: Language) {
  if (language === 'ja' && !i18n.hasResourceBundle('ja', 'ui')) {
    japanese ??= import('../locales/ja.json')
      .then(({ default: resources }) => {
        for (const [namespace, resource] of Object.entries(resources))
          i18n.addResourceBundle('ja', namespace, resource, true, true);
      })
      .catch((error: unknown) => {
        japanese = undefined;
        throw error;
      });
    await japanese;
  }
}

export async function initializeI18n() {
  await i18n.use(initReactI18next).init({
    lng: 'en',
    fallbackLng: 'en',
    supportedLngs: ['en', 'ja'],
    defaultNS: 'ui',
    ns: ['ui', 'food', 'receipt'],
    resources: { en },
    keySeparator: false,
    nsSeparator: false,
    initAsync: false,
    enableSelector: 'optimize',
    returnNull: false,
    interpolation: { escapeValue: false },
    react: { useSuspense: false },
  });
  const preferred = storedLanguage();
  try {
    await applyLanguage(preferred);
  } catch {
    await applyLanguage('en');
    return preferred;
  }
  return undefined;
}

export function getLanguage(): Language {
  return i18n.resolvedLanguage === 'ja' || i18n.language === 'ja'
    ? 'ja'
    : i18n.isInitialized
      ? 'en'
      : storedLanguage();
}

let changeVersion = 0;
let requestedLanguage: Language | undefined;
export function getDesiredLanguage(): Language {
  return requestedLanguage ?? getLanguage();
}
export function cancelLanguageChanges() {
  changeVersion++;
}
export async function applyLanguage(language: Language, animate = false) {
  requestedLanguage = language;
  const version = ++changeVersion;
  await loadLanguage(language);
  if (version !== changeVersion) return;
  const update = () => {
    if (version !== changeVersion) return;
    void i18n.changeLanguage(language);
    document.documentElement.lang = language;
    try {
      localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
    } catch {
      /* In-memory preference still works. */
    }
  };
  if (animate && language !== getLanguage()) await transitionAppearance('language-change', update);
  else update();
}

export function isCopyKey(value: string): value is keyof typeof en.ui {
  return Object.hasOwn(en.ui, value);
}
function isFoodKey(value: string): value is keyof typeof en.food {
  return Object.hasOwn(en.food, value);
}
export function translateCopy(
  value: string | undefined | null,
  variables?: Record<string, string | number>,
  language = getLanguage(),
): string {
  if (!value) return '';
  const retry = /^Too many attempts\. Please wait (\d+) seconds before trying again\.$/.exec(value);
  if (retry?.[1])
    return translateCopy(
      'Too many attempts. Please wait {{count}} seconds before trying again.',
      { count: Number(retry[1]) },
      language,
    );
  if (isCopyKey(value)) return i18n.t(($) => $[value], { ns: 'ui', lng: language, ...variables });
  if (isFoodKey(value)) return i18n.t(($) => $[value], { ns: 'food', lng: language, ...variables });
  const status = value.replaceAll('_', ' ');
  if (isCopyKey(status)) return i18n.t(($) => $[status], { ns: 'ui', lng: language, ...variables });
  return value;
}

export function useCopy() {
  const { i18n: instance } = useTranslation('ui');
  const language = instance.language;
  return useCallback(
    (value: string | undefined | null, variables?: Record<string, string | number>): string =>
      translateCopy(value, variables, isLanguage(language) ? language : 'en'),
    [language],
  );
}

export default i18n;
