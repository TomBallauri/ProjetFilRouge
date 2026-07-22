import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import fr from '../locales/fr/translation.json';
import en from '../locales/en/translation.json';

// Espagnol/Allemand : pas encore traduits (voir réglages), on retombe sur le français
// en attendant plutôt que d'afficher des clés brutes ("auth.login") à l'écran.
i18n
  .use(initReactI18next)
  .init({
    resources: {
      fr: { translation: fr },
      en: { translation: en },
    },
    lng: localStorage.getItem('appLanguageCode') ?? 'fr',
    fallbackLng: 'fr',
    interpolation: { escapeValue: false }, // React échappe déjà le HTML lui-même
  });

export default i18n;
