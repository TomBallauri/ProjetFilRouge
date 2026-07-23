import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { authMiddleware } from '../lib/auth.js';
import { StreakService } from '../../services/StreakService.js';

const LEADERBOARD_SELECT = {
  id: true, username: true, avatar: true, coins: true, xp: true, level: true,
  currentStreak: true, longestStreak: true, lastStreakDate: true,
  _count: { select: { challenges: true } },
  cosmetics: {
    where: { equipped: true },
    select: { cosmeticId: true, equipped: true, cosmetic: { select: { id: true, name: true, type: true, rarity: true, imageUrl: true } } }
  }
};

// `currentStreak` en base peut être périmé (voir StreakService.effectiveStreak) — on
// recalcule donc la vraie valeur avant de classer, sinon un utilisateur inactif depuis
// des jours resterait affiché (et classé) avec une streak qu'il n'a plus.
const withEffectiveStreak = (users) => users
  .map((u) => {
    const { lastStreakDate, ...rest } = u;
    return { ...rest, currentStreak: StreakService.effectiveStreak(u) };
  })
  .sort((a, b) => b.currentStreak - a.currentStreak);

const router = Router();

router.get('/api/leaderboard', async (req, res) => {
  try {
    const users = await prisma.user.findMany({ select: LEADERBOARD_SELECT });
    res.json(withEffectiveStreak(users).slice(0, 50));
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
    });
    res.json(withEffectiveStreak(users));
  } catch (error) {
    res.status(500).json({ error: 'Erreur lors de la récupération du classement amis' });
  }
});

export default router;
