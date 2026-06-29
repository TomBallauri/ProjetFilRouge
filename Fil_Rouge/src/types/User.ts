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
  recentActivities?: { content: string; date: string }[];
}