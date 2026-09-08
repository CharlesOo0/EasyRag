import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import enTranslation from './locales/en.json';
import frTranslation from './locales/fr.json';

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: {
        translation: enTranslation,
      },
      fr: {
        translation: frTranslation,
      },
    },
    fallbackLng: 'fr',
    // Resolve region variants (e.g. 'fr-FR') to the base language so SSR and
    // client agree on <html lang> and only 'fr'/'en' bundles are needed.
    load: 'languageOnly',
    supportedLngs: ['fr', 'en'],
    interpolation: {
      escapeValue: false,
    },
  });

export default i18n;
