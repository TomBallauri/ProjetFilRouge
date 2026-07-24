import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User, UserSettings } from '../types/User';
import { syncSettingsToServer } from './settingsSync';
import i18n, { detectBrowserLanguageCode } from './i18n';

export type NotifToggles = { defis: boolean; messages: boolean; updates: boolean };

const DEFAULT_NOTIF_TOGGLES: NotifToggles = { defis: true, messages: true, updates: false };
const LANGUAGE_TO_HTML_LANG: Record<string, string> = { 'Français': 'fr', 'English': 'en', 'Español': 'es', 'Deutsch': 'de' };
// Inverse de LANGUAGE_TO_HTML_LANG, limité à FR/EN (seules langues réellement détectables
// au premier lancement — voir detectBrowserLanguageCode dans src/lib/i18n.ts).
const CODE_TO_LANGUAGE_NAME: Record<'fr' | 'en', string> = { fr: 'Français', en: 'English' };

const readNotifToggles = (): NotifToggles => {
  try { return JSON.parse(localStorage.getItem('notifToggles') ?? 'null') ?? DEFAULT_NOTIF_TOGGLES; }
  catch { return DEFAULT_NOTIF_TOGGLES; }
};
const readReduceMotion = (): boolean => localStorage.getItem('reduceMotion') === 'true';
// Si l'utilisateur n'a jamais choisi de langue, on affiche dans les réglages celle
// détectée par i18n.ts au démarrage, pour que le sélecteur reste cohérent avec l'UI affichée.
const readLanguage = (): string => localStorage.getItem('appLanguage') ?? CODE_TO_LANGUAGE_NAME[detectBrowserLanguageCode()];

const applyReduceMotionToDom = (on: boolean) => {
  document.documentElement.classList.toggle('reduce-motion', on);
};
const applyLanguageToDom = (lang: string) => {
  const code = LANGUAGE_TO_HTML_LANG[lang] ?? 'fr';
  document.documentElement.lang = code;
  // Espagnol/Allemand ne sont pas encore traduits (voir src/lib/i18n.ts) — i18next retombe
  // sur le français dans ce cas plutôt que d'afficher des clés brutes à l'écran.
  localStorage.setItem('appLanguageCode', code);
  i18n.changeLanguage(code);
};

export type NotifGroup = { groupId: number; seriesName: string; latestMessageId: number | null; latestMessageUserId: number | null };
export type NotifData = {
  pendingFriendRequests: number;
  pendingSeriesInvites: number;
  streakAtRisk: boolean;
  streakDays: number;
  groups: NotifGroup[];
};

interface StoreState {
  user: User | null;
  setUser: (user: User | null) => void;
  darkMode: boolean;
  toggleDarkMode: () => void;

  /* Préférences liées au compte (settings côté serveur) — persistées en localStorage pour
     un accès instantané, et synchronisées vers le backend quand l'utilisateur est connecté. */
  notifToggles: NotifToggles;
  setNotifToggles: (updater: NotifToggles | ((prev: NotifToggles) => NotifToggles)) => void;
  reduceMotion: boolean;
  setReduceMotion: (updater: boolean | ((prev: boolean) => boolean)) => void;
  language: string;
  setLanguage: (lang: string) => void;
  /* Applique les réglages reçus du compte (au login/chargement) sans les repousser au serveur. */
  applyServerSettings: (settings: UserSettings | null | undefined) => void;

  /* Notification state (not persisted) */
  notifData:      NotifData | null;
  notifCount:     number;
  setNotifData:   (data: NotifData | null) => void;
  setNotifCount:  (count: number) => void;

  /* Group chat popup (opened from the notification bell — see GroupChatModal), not persisted */
  activeGroupChatId: number | null;
  openGroupChat:     (groupId: number) => void;
  closeGroupChat:    () => void;

  /* Tutoriel de bienvenue (not persisted — ré-ouvrable depuis le profil) */
  tourOpen: boolean;
  openTour: () => void;
  closeTour: () => void;
}

export const useStore = create<StoreState>()(
  persist(
    (set) => ({
      user: null,
      setUser: (user) => set({ user }),
      darkMode: false,
      toggleDarkMode: () => set((state) => {
        const next = !state.darkMode;
        syncSettingsToServer({ darkMode: next });
        return { darkMode: next };
      }),

      notifToggles: readNotifToggles(),
      setNotifToggles: (updater) => set((state) => {
        const next = typeof updater === 'function' ? updater(state.notifToggles) : updater;
        localStorage.setItem('notifToggles', JSON.stringify(next));
        syncSettingsToServer({ notifDefis: next.defis, notifMessages: next.messages, notifUpdates: next.updates });
        return { notifToggles: next };
      }),
      reduceMotion: readReduceMotion(),
      setReduceMotion: (updater) => set((state) => {
        const next = typeof updater === 'function' ? updater(state.reduceMotion) : updater;
        localStorage.setItem('reduceMotion', String(next));
        applyReduceMotionToDom(next);
        syncSettingsToServer({ reduceMotion: next });
        return { reduceMotion: next };
      }),
      language: readLanguage(),
      setLanguage: (lang) => set(() => {
        localStorage.setItem('appLanguage', lang);
        applyLanguageToDom(lang);
        syncSettingsToServer({ language: lang });
        return { language: lang };
      }),
      applyServerSettings: (settings) => set((state) => {
        if (!settings) return {};
        const patch: Partial<StoreState> = {};
        if (typeof settings.darkMode === 'boolean') patch.darkMode = settings.darkMode;
        if (typeof settings.reduceMotion === 'boolean') {
          patch.reduceMotion = settings.reduceMotion;
          localStorage.setItem('reduceMotion', String(settings.reduceMotion));
          applyReduceMotionToDom(settings.reduceMotion);
        }
        if (typeof settings.language === 'string') {
          patch.language = settings.language;
          localStorage.setItem('appLanguage', settings.language);
          applyLanguageToDom(settings.language);
        }
        if (settings.notifDefis !== undefined || settings.notifMessages !== undefined || settings.notifUpdates !== undefined) {
          const merged: NotifToggles = {
            defis: settings.notifDefis ?? state.notifToggles.defis,
            messages: settings.notifMessages ?? state.notifToggles.messages,
            updates: settings.notifUpdates ?? state.notifToggles.updates,
          };
          patch.notifToggles = merged;
          localStorage.setItem('notifToggles', JSON.stringify(merged));
        }
        return patch;
      }),

      notifData:     null,
      notifCount:    0,
      setNotifData:  (data) => set({ notifData: data }),
      setNotifCount: (count) => set({ notifCount: count }),

      activeGroupChatId: null,
      openGroupChat:      (groupId) => set({ activeGroupChatId: groupId }),
      closeGroupChat:     () => set({ activeGroupChatId: null }),

      tourOpen: false,
      openTour: () => set({ tourOpen: true }),
      closeTour: () => set({ tourOpen: false }),
    }),
    {
      name: 'gameforum-store', // nom de la clé dans le localStorage
      partialize: (state) => ({ user: state.user, darkMode: state.darkMode }),
    }
  )
);