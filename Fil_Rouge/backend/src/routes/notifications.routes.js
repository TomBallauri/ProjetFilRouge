import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { authMiddleware } from '../lib/auth.js';
import { seriesGroupReady, expireStaleInvites } from '../lib/groupHelpers.js';
import { StreakService } from '../../services/StreakService.js';

const router = Router();

router.get('/api/notifications', authMiddleware, async (req, res) => {
  const userId = req.userId;
  const today = new Date(); today.setHours(0, 0, 0, 0);

  await expireStaleInvites();
  const [friendRequests, seriesInvites, userInfo, seriesGroups] = await Promise.all([
    prisma.friend.count({ where: { receiverId: userId, status: 'PENDING' } }),
    seriesGroupReady()
      ? prisma.seriesGroupMember.count({ where: { userId, status: 'INVITED' } })
      : Promise.resolve(0),
    prisma.user.findUnique({ where: { id: userId }, select: { currentStreak: true, lastStreakDate: true } }),
    seriesGroupReady()
      ? prisma.seriesGroup.findMany({
          where: { members: { some: { userId, status: 'JOINED' } } },
          select: {
            id: true,
            seriesName: true,
            messages: { select: { id: true, userId: true }, orderBy: { createdAt: 'desc' }, take: 1 },
          },
        })
      : Promise.resolve([]),
  ]);

  // `currentStreak` en base peut être périmé (voir StreakService.effectiveStreak) si
  // l'utilisateur n'a rien complété depuis plusieurs jours — sans ça, la bannière
  // "streak en danger" continuerait d'afficher une streak déjà perdue.
  const effectiveStreak = StreakService.effectiveStreak(userInfo ?? { currentStreak: 0, lastStreakDate: null });
  const streakAtRisk =
    effectiveStreak > 0 &&
    (!userInfo?.lastStreakDate || new Date(userInfo.lastStreakDate) < today);

  res.json({
    pendingFriendRequests: friendRequests,
    pendingSeriesInvites: seriesInvites,
    streakAtRisk: !!streakAtRisk,
    streakDays: effectiveStreak,
    groups: seriesGroups.map(g => ({
      groupId: g.id,
      seriesName: g.seriesName,
      latestMessageId: g.messages[0]?.id ?? null,
      latestMessageUserId: g.messages[0]?.userId ?? null,
    })),
  });
});

export default router;
