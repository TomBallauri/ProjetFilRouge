import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { authMiddleware } from '../lib/auth.js';

const router = Router();

// Envoyer une demande d'ami
router.post('/api/friends/request/:targetId', authMiddleware, async (req, res) => {
  const senderId = req.userId;
  const receiverId = Number(req.params.targetId);
  if (senderId === receiverId) return res.status(400).json({ error: 'Tu ne peux pas t\'ajouter toi-même.' });
  try {
    const existing = await prisma.friend.findFirst({
      where: { OR: [{ senderId, receiverId }, { senderId: receiverId, receiverId: senderId }] }
    });
    if (existing) return res.status(400).json({ error: 'Demande déjà envoyée ou déjà amis.' });
    const friend = await prisma.friend.create({ data: { senderId, receiverId } });
    res.json(friend);
  } catch (error) {
    res.status(400).json({ error: 'Erreur lors de l\'envoi de la demande.' });
  }
});

// Accepter une demande
router.post('/api/friends/accept/:requestId', authMiddleware, async (req, res) => {
  const requestId = Number(req.params.requestId);
  try {
    const request = await prisma.friend.findUnique({ where: { id: requestId } });
    if (!request || request.receiverId !== req.userId) return res.status(403).json({ error: 'Non autorisé.' });
    if (request.status !== 'PENDING') return res.status(400).json({ error: 'Demande déjà traitée.' });
    const updated = await prisma.friend.update({ where: { id: requestId }, data: { status: 'ACCEPTED' } });
    res.json(updated);
  } catch (error) {
    res.status(400).json({ error: 'Erreur lors de l\'acceptation.' });
  }
});

// Refuser / supprimer un ami
router.delete('/api/friends/:requestId', authMiddleware, async (req, res) => {
  const requestId = Number(req.params.requestId);
  try {
    const request = await prisma.friend.findUnique({ where: { id: requestId } });
    if (!request) return res.status(404).json({ error: 'Demande introuvable.' });
    if (request.senderId !== req.userId && request.receiverId !== req.userId) {
      return res.status(403).json({ error: 'Non autorisé.' });
    }
    await prisma.friend.delete({ where: { id: requestId } });
    res.json({ message: 'Ami supprimé.' });
  } catch (error) {
    res.status(400).json({ error: 'Erreur lors de la suppression.' });
  }
});

// Liste des amis acceptés
router.get('/api/friends', authMiddleware, async (req, res) => {
  try {
    const rows = await prisma.friend.findMany({
      where: { OR: [{ senderId: req.userId }, { receiverId: req.userId }], status: 'ACCEPTED' },
      include: {
        sender:   { select: { id: true, username: true, avatar: true, level: true, xp: true } },
        receiver: { select: { id: true, username: true, avatar: true, level: true, xp: true } },
      }
    });
    const friends = rows.map(r => ({
      friendshipId: r.id,
      since: r.createdAt,
      user: r.senderId === req.userId ? r.receiver : r.sender,
    }));
    res.json(friends);
  } catch (error) {
    res.status(500).json({ error: 'Erreur lors de la récupération des amis.' });
  }
});

// Demandes reçues en attente
router.get('/api/friends/requests', authMiddleware, async (req, res) => {
  try {
    const requests = await prisma.friend.findMany({
      where: { receiverId: req.userId, status: 'PENDING' },
      include: { sender: { select: { id: true, username: true, avatar: true, level: true } } },
      orderBy: { createdAt: 'desc' }
    });
    res.json(requests);
  } catch (error) {
    res.status(500).json({ error: 'Erreur lors de la récupération des demandes.' });
  }
});

// Statut d'amitié avec un user
router.get('/api/friends/status/:targetId', authMiddleware, async (req, res) => {
  const targetId = Number(req.params.targetId);
  try {
    const row = await prisma.friend.findFirst({
      where: { OR: [{ senderId: req.userId, receiverId: targetId }, { senderId: targetId, receiverId: req.userId }] }
    });
    if (!row) return res.json({ status: 'NONE' });
    res.json({ status: row.status, requestId: row.id, isSender: row.senderId === req.userId });
  } catch (error) {
    res.status(500).json({ error: 'Erreur.' });
  }
});

export default router;
