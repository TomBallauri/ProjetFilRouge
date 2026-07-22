import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { authMiddleware } from '../lib/auth.js';

const LEADERBOARD_SELECT = {
  id: true, username: true, avatar: true, coins: true, xp: true, level: true,
  currentStreak: true, longestStreak: true,
  _count: { select: { challenges: true } },
  cosmetics: {
    where: { equipped: true },
    select: { cosmeticId: true, equipped: true, cosmetic: { select: { id: true, name: true, type: true, rarity: true, imageUrl: true } } }
  }
};

const router = Router();

router.get('/api/leaderboard', async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      select: LEADERBOARD_SELECT,
      orderBy: { currentStreak: 'desc' },
      take: 50
    });
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: "Erreur lors de la récupération du classement" });
  }
});

router.get('/api/leaderboard/friends', authMiddleware, async (req, res) => {
  try {
    // Use a single query: fetch users who are accepted friends of req.userId (or req.userId themselves)
    const users = await prisma.user.findMany({
      where: {
        OR: [
          { id: req.userId },
          { sentFriendRequests:     { some: { receiverId: req.userId, status: 'ACCEPTED' } } },
          { receivedFriendRequests: { some: { senderId:   req.userId, status: 'ACCEPTED' } } },
        ]
      },
      select: LEADERBOARD_SELECT,
      orderBy: { currentStreak: 'desc' }
    });
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: 'Erreur lors de la récupération du classement amis' });
  }
});

export default router;
