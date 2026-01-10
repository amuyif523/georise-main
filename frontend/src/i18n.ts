import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import enTranslation from './locales/en/translation.json';
import amTranslation from './locales/am/translation.json';
import omTranslation from './locales/om/translation.json';
import soTranslation from './locales/so/translation.json';

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: enTranslation },
      am: { translation: amTranslation },
      om: { translation: omTranslation },
      so: { translation: soTranslation },
    },

    fallbackLng: ['en'],
    debug: true,
    saveMissing: true,
    interpolation: {
      escapeValue: false, // not needed for react as it escapes by default
    },
    detection: {
      order: ['localStorage', 'querystring', 'navigator'],
      caches: ['localStorage'],
    },
    missingKeyHandler: (_lng, _ns, key) => {
      try {
        const stored = localStorage.getItem('i18n_missing_keys');
        const parsed: string[] = stored ? JSON.parse(stored) : [];
        if (!parsed.includes(key)) {
          parsed.push(key);
          localStorage.setItem('i18n_missing_keys', JSON.stringify(parsed));
        }
      } catch {
        // swallow; this is best-effort for dev inventory
        console.warn('i18n missing key (inventory only):', key);
      }
    },
  });

// Keep document language in sync for accessibility/screen readers
i18n.on('languageChanged', (lng) => {
  if (typeof document !== 'undefined') {
    document.documentElement.lang = lng;
  }
});

export default i18n;
