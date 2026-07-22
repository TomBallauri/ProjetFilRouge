import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { authMiddleware } from '../lib/auth.js';
import { streakService } from '../lib/streak.js';
import { isInviteExpired, expireStaleInvites, GROUP_LIST_INCLUDE, GROUP_INCLUDE } from '../lib/groupHelpers.js';

const MSG_USER_SELECT = {
  select: {
    id: true, username: true, avatar: true,
    cosmetics: {
      where: { equipped: true },
      select: {
        cosmeticId: true, equipped: true,
        cosmetic: { select: { id: true, name: true, type: true, rarity: true, imageUrl: true } }
      }
    }
  }
};

const router = Router();

// Créer un groupe et inviter des amis (max 4 membres au total)
router.post('/api/groups', authMiddleware, async (req, res) => {
  const { challengeId, friendIds } = req.body;
  if (!challengeId) return res.status(400).json({ error: 'challengeId requis' });
  const inviteList = Array.isArray(friendIds) ? friendIds.map(Number).filter(Boolean) : [];
  if (inviteList.length > 3) return res.status(400).json({ error: 'Maximum 3 amis invités (4 personnes au total).' });
  try {
    const challenge = await prisma.challenge.findUnique({ where: { id: Number(challengeId) } });
    if (!challenge) return res.status(404).json({ error: 'Défi introuvable' });
    const group = await prisma.challengeGroup.create({
      data: {
        challengeId: Number(challengeId),
        createdBy: req.userId,
        members: {
          create: [
            { userId: req.userId, status: 'JOINED', joinedAt: new Date() },
            ...inviteList.map(id => ({ userId: id, status: 'INVITED' }))
          ]
        }
      },
      include: GROUP_INCLUDE
    });
    res.json(group);
  } catch (error) {
    // Le détail (error.message, potentiellement une erreur Prisma exposant noms de
    // table/colonne) reste dans les logs serveur — jamais renvoyé tel quel au client.
    console.error('[groups] création:', error?.message ?? error);
    res.status(500).json({ error: 'Erreur lors de la création du groupe' });
  }
});

// Mes groupes (comme créateur ou membre)
router.get('/api/groups', authMiddleware, async (req, res) => {
  try {
    await expireStaleInvites();
    const groups = await prisma.challengeGroup.findMany({
      where: { members: { some: { userId: req.userId } } },
      include: GROUP_LIST_INCLUDE,
      orderBy: { createdAt: 'desc' }
    });
    res.json(groups);
  } catch (error) {
    res.status(500).json({ error: 'Erreur lors de la récupération des groupes' });
  }
});

// Inviter des amis dans un groupe existant
router.post('/api/groups/:id/invite', authMiddleware, async (req, res) => {
  const groupId = Number(req.params.id);
  const inviteList = Array.isArray(req.body.friendIds) ? req.body.friendIds.map(Number).filter(Boolean) : [];
  if (!inviteList.length) return res.status(400).json({ error: 'Aucun ami sélectionné' });
  try {
    const group = await prisma.challengeGroup.findUnique({ where: { id: groupId }, include: { members: true } });
    if (!group) return res.status(404).json({ error: 'Groupe introuvable' });
    if (!group.members.some(m => m.userId === req.userId)) return res.status(403).json({ error: 'Non membre du groupe' });
    const alreadyIn = new Set(group.members.map(m => m.userId));
    const toInvite = inviteList.filter(id => !alreadyIn.has(id));
    if (group.members.length + toInvite.length > 4) return res.status(400).json({ error: 'Maximum 4 membres au total' });
    if (toInvite.length > 0) {
      await prisma.challengeGroupMember.createMany({
        data: toInvite.map(userId => ({ groupId, userId, status: 'INVITED' })),
        skipDuplicates: true,
      });
    }
    const updated = await prisma.challengeGroup.findUnique({ where: { id: groupId }, include: GROUP_INCLUDE });
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: 'Erreur lors de l\'invitation' });
  }
});

// Accepter une invitation
router.post('/api/groups/:id/join', authMiddleware, async (req, res) => {
  const groupId = Number(req.params.id);
  try {
    const member = await prisma.challengeGroupMember.findUnique({
      where: { groupId_userId: { groupId, userId: req.userId } }
    });
    if (!member) return res.status(404).json({ error: 'Invitation introuvable' });
    if (member.status !== 'INVITED') return res.status(400).json({ error: 'Déjà rejoint' });
    if (isInviteExpired(member.invitedAt)) {
      await prisma.challengeGroupMember.delete({ where: { groupId_userId: { groupId, userId: req.userId } } });
      return res.status(410).json({ error: 'Invitation expirée' });
    }
    const updated = await prisma.challengeGroupMember.update({
      where: { groupId_userId: { groupId, userId: req.userId } },
      data: { status: 'JOINED', joinedAt: new Date() }
    });
    res.json(updated);
  } catch (error) {
    res.status(400).json({ error: 'Erreur lors de la jonction' });
  }
});

// Refuser / quitter un groupe
router.delete('/api/groups/:id/leave', authMiddleware, async (req, res) => {
  const groupId = Number(req.params.id);
  try {
    await prisma.challengeGroupMember.delete({
      where: { groupId_userId: { groupId, userId: req.userId } }
    });
    res.json({ message: 'Groupe quitté' });
  } catch (error) {
    res.status(400).json({ error: 'Erreur lors du départ' });
  }
});

// Marquer le défi de groupe comme complété
router.post('/api/groups/:id/complete', authMiddleware, async (req, res) => {
  const groupId = Number(req.params.id);
  try {
    const member = await prisma.challengeGroupMember.findUnique({
      where: { groupId_userId: { groupId, userId: req.userId } }
    });
    if (!member) return res.status(404).json({ error: 'Non membre du groupe' });
    if (member.status === 'COMPLETED') return res.status(400).json({ error: 'Déjà complété' });
    if (member.status === 'INVITED') return res.status(400).json({ error: 'Rejoins le groupe d\'abord' });
    await prisma.challengeGroupMember.update({
      where: { groupId_userId: { groupId, userId: req.userId } },
      data: { status: 'COMPLETED', completedAt: new Date() }
    });
    let streakResult = null;
    try { streakResult = await streakService.updateForUser(req.userId); } catch {}
    const group = await prisma.challengeGroup.findUnique({ where: { id: groupId }, include: GROUP_INCLUDE });
    // Compte uniquement les membres qui ont rejoint (pas invités)
    const joinedMembers = group.members.filter(m => m.status !== 'INVITED');
    const allCompleted = joinedMembers.length > 0 && joinedMembers.every(m => m.status === 'COMPLETED');
    res.json({ group, allCompleted, streak: streakResult });
  } catch (error) {
    res.status(400).json({ error: 'Erreur lors de la complétion' });
  }
});

// Messages du tchat de groupe
router.get('/api/groups/:id/messages', authMiddleware, async (req, res) => {
  const groupId = Number(req.params.id);
  try {
    const member = await prisma.challengeGroupMember.findUnique({
      where: { groupId_userId: { groupId, userId: req.userId } }
    });
    if (!member) return res.status(403).json({ error: 'Non membre du groupe' });
    const messages = await prisma.groupMessage.findMany({
      where: { groupId },
      include: { user: MSG_USER_SELECT },
      orderBy: { createdAt: 'asc' },
      take: 100
    });
    res.json(messages);
  } catch (error) {
    res.status(500).json({ error: 'Erreur lors de la récupération des messages' });
  }
});

// Envoyer un message dans le tchat de groupe
router.post('/api/groups/:id/messages', authMiddleware, async (req, res) => {
  const groupId = Number(req.params.id);
  const { content } = req.body;
  if (!content?.trim()) return res.status(400).json({ error: 'Message vide' });
  try {
    const member = await prisma.challengeGroupMember.findUnique({
      where: { groupId_userId: { groupId, userId: req.userId } }
    });
    if (!member) return res.status(403).json({ error: 'Non membre du groupe' });
    if (member.status === 'INVITED') return res.status(403).json({ error: 'Rejoins le groupe pour envoyer des messages' });
    const message = await prisma.groupMessage.create({
      data: { groupId, userId: req.userId, content: content.trim() },
      include: { user: MSG_USER_SELECT }
    });
    res.json(message);
  } catch (error) {
    res.status(500).json({ error: 'Erreur lors de l\'envoi du message' });
  }
});

export default router;
