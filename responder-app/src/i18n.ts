import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// Minimal resources for now
const resources = {
  en: {
    translation: {
      common: {
        login: 'Login',
        email: 'Email',
        password: 'Password',
        submit: 'Submit',
        loading: 'Loading...',
        logout: 'Logout',
        onDuty: 'On Duty',
      },
      status: {
        assigned: 'Assigned',
        responding: 'Responding',
        onScene: 'On Scene',
        resolved: 'Resolved',
      },
      actions: {
        arrive: 'I HAVE ARRIVED',
        navigate: 'Navigate',
        resolve: 'Resolve',
      },
    },
  },
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false,
    },
  });

export default i18n;
