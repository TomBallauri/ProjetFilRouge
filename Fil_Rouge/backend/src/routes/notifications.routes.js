import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { authMiddleware } from '../lib/auth.js';
import { seriesGroupReady, expireStaleInvites } from '../lib/groupHelpers.js';

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

  const streakAtRisk =
    (userInfo?.currentStreak ?? 0) > 0 &&
    (!userInfo?.lastStreakDate || new Date(userInfo.lastStreakDate) < today);

  res.json({
    pendingFriendRequests: friendRequests,
    pendingSeriesInvites: seriesInvites,
    streakAtRisk: !!streakAtRisk,
    streakDays: userInfo?.currentStreak ?? 0,
    groups: seriesGroups.map(g => ({
      groupId: g.id,
      seriesName: g.seriesName,
      latestMessageId: g.messages[0]?.id ?? null,
      latestMessageUserId: g.messages[0]?.userId ?? null,
    })),
  });
});

export default router;
