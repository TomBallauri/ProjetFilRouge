import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import fr from '../locales/fr/translation.json';
import en from '../locales/en/translation.json';

// Tant qu'aucune préférence n'est enregistrée (première visite), on se base sur la langue
// du navigateur plutôt que de forcer le français — seuls FR/EN sont réellement traduits,
// donc tout ce qui n'est pas anglais retombe sur le français (comportement déjà attendu).
export const detectBrowserLanguageCode = (): 'fr' | 'en' =>
  navigator.language?.toLowerCase().startsWith('en') ? 'en' : 'fr';

// Espagnol/Allemand : pas encore traduits (voir réglages), on retombe sur le français
// en attendant plutôt que d'afficher des clés brutes ("auth.login") à l'écran.
i18n
  .use(initReactI18next)
  .init({
    resources: {
      fr: { translation: fr },
      en: { translation: en },
    },
    lng: localStorage.getItem('appLanguageCode') ?? detectBrowserLanguageCode(),
    fallbackLng: 'fr',
    interpolation: { escapeValue: false }, // React échappe déjà le HTML lui-même
  });

export default i18n;
