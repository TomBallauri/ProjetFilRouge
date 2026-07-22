import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { authMiddleware } from '../lib/auth.js';
import {
  seriesGroupReady,
  sgMsgReady,
  isInviteExpired,
  expireStaleInvites,
} from '../lib/groupHelpers.js';

const SERIES_GROUP_INCLUDE = {
  creator: { select: { id: true, username: true, avatar: true } },
  members: {
    include: { user: { select: { id: true, username: true, avatar: true } } },
    orderBy: { invitedAt: 'asc' }
  }
};

// Helper : s'assure que tous les défis d'une série sont IN_PROGRESS pour un utilisateur
async function ensureSeriesChallengesStarted(userId, seriesName) {
  const challenges = await prisma.challenge.findMany({ where: { seriesName }, select: { id: true } });
  if (!challenges.length) return;
  // createMany + skipDuplicates = 2 queries instead of N+1; existing COMPLETED rows are skipped untouched
  await prisma.userChallenge.createMany({
    data: challenges.map(c => ({ userId, challengeId: c.id, status: 'IN_PROGRESS' })),
    skipDuplicates: true,
  });
}

const router = Router();

// Démarrer tous les défis restants d'une série en une fois (sans passer par un groupe)
router.post('/api/challenges/series/:seriesName/start-all', authMiddleware, async (req, res) => {
  const seriesName = decodeURIComponent(req.params.seriesName);
  try {
    await ensureSeriesChallengesStarted(req.userId, seriesName);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Erreur lors du démarrage de la série' });
  }
});

// Créer un groupe de série
router.post('/api/series-groups', authMiddleware, async (req, res) => {
  if (!seriesGroupReady()) return res.status(503).json({ error: 'Migration en attente — relance le serveur.' });
  const { seriesName, friendIds } = req.body;
  if (!seriesName) return res.status(400).json({ error: 'seriesName requis' });
  const inviteList = Array.isArray(friendIds) ? friendIds.map(Number).filter(Boolean) : [];
  if (inviteList.length > 3) return res.status(400).json({ error: 'Maximum 3 amis invités.' });
  try {
    const existing = await prisma.seriesGroup.findFirst({
      where: { seriesName, members: { some: { userId: req.userId } } }
    });
    if (existing) return res.status(400).json({ error: 'Tu as déjà un groupe pour cette série.' });
    const group = await prisma.seriesGroup.create({
      data: {
        seriesName,
        createdBy: req.userId,
        members: {
          create: [
            { userId: req.userId, status: 'JOINED', joinedAt: new Date() },
            ...inviteList.map(id => ({ userId: id, status: 'INVITED' }))
          ]
        }
      },
      include: SERIES_GROUP_INCLUDE
    });
    // Fire-and-forget: start challenges without blocking the response
    ensureSeriesChallengesStarted(req.userId, seriesName).catch(() => {});
    res.json(group);
  } catch (error) {
    res.status(500).json({ error: error?.message ?? 'Erreur lors de la création' });
  }
});

// Récupérer le groupe d'une série (pour l'utilisateur courant) + progression des membres
router.get('/api/series-groups/by-series/:seriesName', authMiddleware, async (req, res) => {
  if (!seriesGroupReady()) return res.json(null);
  const seriesName = decodeURIComponent(req.params.seriesName);
  try {
    const groups = await prisma.seriesGroup.findMany({
      where: { seriesName, members: { some: { userId: req.userId } } },
      include: SERIES_GROUP_INCLUDE
    });
    if (!groups.length) return res.json(null);
    // Prefer the group with the most JOINED members (avoids returning a solo group when user was also invited to a richer one)
    const group = groups.sort((a, b) => {
      const aJ = a.members.filter(m => m.status === 'JOINED').length;
      const bJ = b.members.filter(m => m.status === 'JOINED').length;
      return bJ - aJ;
    })[0];
    // Progression de chaque membre dans la série
    const memberIds = group.members.map(m => m.userId);
    const [total, ...doneCounts] = await Promise.all([
      prisma.challenge.count({ where: { seriesName } }),
      ...memberIds.map(uid => prisma.userChallenge.count({
        where: { userId: uid, status: 'COMPLETED', challenge: { seriesName } }
      }))
    ]);
    const progress = memberIds.map((uid, i) => ({ userId: uid, done: doneCounts[i], total }));
    res.json({ ...group, progress });
  } catch (error) {
    res.status(500).json({ error: 'Erreur' });
  }
});

// Rejoindre (accepter invitation)
router.post('/api/series-groups/:id/join', authMiddleware, async (req, res) => {
  if (!seriesGroupReady()) return res.status(503).json({ error: 'Migration en attente.' });
  const groupId = Number(req.params.id);
  try {
    // Parallel: check membership + get group info
    const [member, group] = await Promise.all([
      prisma.seriesGroupMember.findUnique({ where: { groupId_userId: { groupId, userId: req.userId } } }),
      prisma.seriesGroup.findUnique({ where: { id: groupId } })
    ]);
    if (!member) return res.status(404).json({ error: 'Invitation introuvable' });
    if (member.status !== 'INVITED') return res.status(400).json({ error: 'Déjà rejoint' });
    if (!group) return res.status(404).json({ error: 'Groupe introuvable' });
    if (isInviteExpired(member.invitedAt) || group.completedAt) {
      await prisma.seriesGroupMember.delete({ where: { groupId_userId: { groupId, userId: req.userId } } });
      return res.status(410).json({ error: 'Invitation expirée' });
    }
    await prisma.seriesGroupMember.update({
      where: { groupId_userId: { groupId, userId: req.userId } },
      data: { status: 'JOINED', joinedAt: new Date() }
    });
    // Parallel: fetch updated group + start challenges for the new member
    const [updated] = await Promise.all([
      prisma.seriesGroup.findUnique({ where: { id: groupId }, include: SERIES_GROUP_INCLUDE }),
      ensureSeriesChallengesStarted(req.userId, group.seriesName)
    ]);
    const memberIds = updated.members.map(m => m.userId);
    const sn = updated.seriesName;
    const [total, ...doneCounts] = await Promise.all([
      prisma.challenge.count({ where: { seriesName: sn } }),
      ...memberIds.map(uid => prisma.userChallenge.count({
        where: { userId: uid, status: 'COMPLETED', challenge: { seriesName: sn } }
      }))
    ]);
    const progress = memberIds.map((uid, i) => ({ userId: uid, done: doneCounts[i], total }));
    res.json({ ...updated, progress });
  } catch (error) {
    res.status(500).json({ error: 'Erreur' });
  }
});

// Chaque membre confirme individuellement avoir terminé la série ; le groupe n'est
// marqué "terminé" que lorsque TOUS les membres JOINED ont confirmé.
router.post('/api/series-groups/:id/complete', authMiddleware, async (req, res) => {
  if (!seriesGroupReady()) return res.status(503).json({ error: 'Migration en attente.' });
  const groupId = Number(req.params.id);
  try {
    const [member, group] = await Promise.all([
      prisma.seriesGroupMember.findUnique({ where: { groupId_userId: { groupId, userId: req.userId } } }),
      prisma.seriesGroup.findUnique({ where: { id: groupId }, include: SERIES_GROUP_INCLUDE })
    ]);
    if (!member || member.status !== 'JOINED') return res.status(403).json({ error: 'Non membre du groupe' });
    if (!group) return res.status(404).json({ error: 'Groupe introuvable' });

    const joinedIds = group.members.filter(m => m.status === 'JOINED').map(m => m.userId);
    const [total, ...doneCounts] = await Promise.all([
      prisma.challenge.count({ where: { seriesName: group.seriesName } }),
      ...joinedIds.map(uid => prisma.userChallenge.count({
        where: { userId: uid, status: 'COMPLETED', challenge: { seriesName: group.seriesName } }
      }))
    ]);
    const progress = joinedIds.map((uid, i) => ({ userId: uid, done: doneCounts[i], total }));
    const myProgress = progress.find(p => p.userId === req.userId);
    const myDone = !!myProgress && myProgress.total > 0 && myProgress.done === myProgress.total;
    if (!myDone) return res.status(400).json({ error: "Tu n'as pas encore terminé tous les défis de la série." });

    if (!member.confirmedAt) {
      await prisma.seriesGroupMember.update({
        where: { groupId_userId: { groupId, userId: req.userId } },
        data: { confirmedAt: new Date() }
      });
    }

    const refreshed = await prisma.seriesGroup.findUnique({ where: { id: groupId }, include: SERIES_GROUP_INCLUDE });
    const allConfirmed = joinedIds.length > 0 && refreshed.members
      .filter(m => m.status === 'JOINED')
      .every(m => !!m.confirmedAt);

    const updated = (refreshed.completedAt || !allConfirmed) ? refreshed : await prisma.seriesGroup.update({
      where: { id: groupId },
      data: { completedAt: new Date() },
      include: SERIES_GROUP_INCLUDE
    });
    res.json({ ...updated, progress });
  } catch (error) {
    res.status(500).json({ error: 'Erreur' });
  }
});

// Quitter un groupe de série
router.delete('/api/series-groups/:id/leave', authMiddleware, async (req, res) => {
  if (!seriesGroupReady()) return res.status(503).json({ error: 'Migration en attente.' });
  const groupId = Number(req.params.id);
  try {
    await prisma.seriesGroupMember.delete({
      where: { groupId_userId: { groupId, userId: req.userId } }
    });
    // Un groupe sans aucun membre est un zombie : il ne bloque plus la création
    // d'un nouveau groupe pour la même série mais reste affiché ailleurs. Autant le supprimer.
    const remaining = await prisma.seriesGroupMember.count({ where: { groupId } });
    if (remaining === 0) await prisma.seriesGroup.delete({ where: { id: groupId } });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Erreur' });
  }
});

// Mes groupes de série (invitations en attente incluses)
router.get('/api/series-groups/mine', authMiddleware, async (req, res) => {
  try {
    await expireStaleInvites();
    const groups = await prisma.seriesGroup.findMany({
      where: { members: { some: { userId: req.userId } } },
      include: SERIES_GROUP_INCLUDE,
      orderBy: { createdAt: 'desc' }
    });
    res.json(groups);
  } catch (error) {
    res.status(500).json({ error: 'Erreur' });
  }
});

// Inviter des amis dans un groupe de série existant
router.post('/api/series-groups/:id/invite', authMiddleware, async (req, res) => {
  if (!seriesGroupReady()) return res.status(503).json({ error: 'Migration en attente.' });
  const groupId = Number(req.params.id);
  const inviteList = Array.isArray(req.body.friendIds) ? req.body.friendIds.map(Number).filter(Boolean) : [];
  if (!inviteList.length) return res.status(400).json({ error: 'Aucun ami sélectionné' });
  try {
    const group = await prisma.seriesGroup.findUnique({ where: { id: groupId }, include: { members: true } });
    if (!group) return res.status(404).json({ error: 'Groupe introuvable' });
    if (!group.members.some(m => m.userId === req.userId)) return res.status(403).json({ error: 'Non membre' });
    if (group.completedAt) return res.status(400).json({ error: 'Série déjà terminée.' });
    const alreadyIn = new Set(group.members.map(m => m.userId));
    const toInvite = inviteList.filter(id => !alreadyIn.has(id));
    if (toInvite.length > 0) {
      await prisma.seriesGroupMember.createMany({
        data: toInvite.map(userId => ({ groupId, userId, status: 'INVITED' })),
        skipDuplicates: true,
      });
    }
    const updated = await prisma.seriesGroup.findUnique({ where: { id: groupId }, include: SERIES_GROUP_INCLUDE });
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: "Erreur lors de l'invitation" });
  }
});

// Exclure un membre (créateur uniquement)
router.delete('/api/series-groups/:id/members/:userId', authMiddleware, async (req, res) => {
  if (!seriesGroupReady()) return res.status(503).json({ error: 'Migration en attente.' });
  const groupId = Number(req.params.id);
  const targetUserId = Number(req.params.userId);
  try {
    const group = await prisma.seriesGroup.findUnique({ where: { id: groupId } });
    if (!group) return res.status(404).json({ error: 'Groupe introuvable' });
    if (group.createdBy !== req.userId) return res.status(403).json({ error: 'Seul le créateur peut exclure.' });
    if (targetUserId === req.userId) return res.status(400).json({ error: 'Impossible de s\'exclure soi-même.' });
    if (group.completedAt) return res.status(400).json({ error: 'Série déjà terminée.' });
    await prisma.seriesGroupMember.delete({ where: { groupId_userId: { groupId, userId: targetUserId } } });
    const updated = await prisma.seriesGroup.findUnique({ where: { id: groupId }, include: SERIES_GROUP_INCLUDE });
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: 'Erreur lors de l\'exclusion' });
  }
});

// Invitations en attente (status INVITED) pour l'utilisateur courant
router.get('/api/series-groups/pending-invites', authMiddleware, async (req, res) => {
  if (!seriesGroupReady()) return res.json([]);
  try {
    await expireStaleInvites();
    const groups = await prisma.seriesGroup.findMany({
      where: { members: { some: { userId: req.userId, status: 'INVITED' } } },
      include: {
        creator: { select: { id: true, username: true, avatar: true } },
        members: { include: { user: { select: { id: true, username: true, avatar: true } } } },
      },
    });
    res.json(groups);
  } catch { res.status(500).json({ error: 'Erreur' }); }
});

// ─── TCHAT GROUPES DE SÉRIE ───────────────────────────────────────────────────

// Récupérer les messages du tchat
// Détail d'un groupe + messages (pour la page de chat dédiée)
router.get('/api/series-groups/:id', authMiddleware, async (req, res) => {
  if (!seriesGroupReady()) return res.status(503).json({ error: 'Non disponible' });
  const groupId = Number(req.params.id);
  try {
    await expireStaleInvites();
    const [member, group] = await Promise.all([
      prisma.seriesGroupMember.findUnique({ where: { groupId_userId: { groupId, userId: req.userId } } }),
      prisma.seriesGroup.findUnique({
        where: { id: groupId },
        include: {
          creator: { select: { id: true, username: true, avatar: true } },
          members: {
            include: { user: { select: { id: true, username: true, avatar: true } } },
            orderBy: { invitedAt: 'asc' },
          },
          messages: {
            include: { user: { select: { id: true, username: true, avatar: true } } },
            orderBy: { createdAt: 'asc' },
            take: 100,
          },
        },
      }),
    ]);
    if (!member) return res.status(403).json({ error: 'Non membre' });
    if (!group) return res.status(404).json({ error: 'Groupe introuvable' });
    res.json(group);
  } catch { res.status(500).json({ error: 'Erreur' }); }
});

router.get('/api/series-groups/:id/messages', authMiddleware, async (req, res) => {
  if (!sgMsgReady()) return res.json([]);
  const groupId = Number(req.params.id);
  try {
    // Parallel: membership check + message fetch
    const [member, messages] = await Promise.all([
      prisma.seriesGroupMember.findUnique({ where: { groupId_userId: { groupId, userId: req.userId } } }),
      prisma.seriesGroupMessage.findMany({
        where: { groupId },
        include: { user: { select: { id: true, username: true, avatar: true } } },
        orderBy: { createdAt: 'asc' },
        take: 100,
      })
    ]);
    if (!member) return res.status(403).json({ error: 'Non membre' });
    res.json(messages);
  } catch { res.status(500).json({ error: 'Erreur' }); }
});

// Envoyer un message dans le tchat
router.post('/api/series-groups/:id/messages', authMiddleware, async (req, res) => {
  if (!sgMsgReady()) return res.status(503).json({ error: 'Migration en attente' });
  const groupId = Number(req.params.id);
  const { content } = req.body;
  if (!content?.trim()) return res.status(400).json({ error: 'Message vide' });
  try {
    const member = await prisma.seriesGroupMember.findUnique({
      where: { groupId_userId: { groupId, userId: req.userId } }
    });
    if (!member || member.status === 'INVITED') return res.status(403).json({ error: 'Non autorisé' });
    const message = await prisma.seriesGroupMessage.create({
      data: { groupId, userId: req.userId, content: content.trim() },
      include: { user: { select: { id: true, username: true, avatar: true } } },
    });
    res.json(message);
  } catch { res.status(500).json({ error: 'Erreur' }); }
});

export default router;
