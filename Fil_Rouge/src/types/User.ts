export interface User {
  id: number;
  username: string;
  email: string;
  bio?: string;
  avatar?: string;
  banner?: string;
  isAdmin?: boolean;
  createdAt: string;
  gamesPlayed?: number;
  tournamentsWon?: number;
  discussionsStarted?: number;
  reputation?: number;
  recentActivities?: { content: string; date: string }[];
}