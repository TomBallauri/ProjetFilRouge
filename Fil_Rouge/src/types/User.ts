import type { EquippedCosmetic } from '../lib/cosmetics';

export interface UserSettings {
  darkMode?: boolean;
  notifDefis?: boolean;
  notifMessages?: boolean;
  notifUpdates?: boolean;
  reduceMotion?: boolean;
  language?: string;
}

export interface User {
  id: number;
  username: string;
  email: string;
  bio?: string;
  avatar?: string;
  banner?: string;
  isAdmin?: boolean;
  createdAt: string;
  coins: number;
  xp: number;
  level: number;
  gamesPlayed?: number;
  tournamentsWon?: number;
  discussionsStarted?: number;
  reputation?: number;
  currentStreak?: number;
  longestStreak?: number;
  recentActivities?: { content: string; date: string }[];
  settings?: UserSettings;
  cosmetics?: EquippedCosmetic[];
}