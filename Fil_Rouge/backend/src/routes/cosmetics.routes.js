import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma.js';
import { SECRET, authMiddleware, isAdmin } from '../lib/auth.js';
import { sanitizeUser } from '../lib/userUtils.js';
import { withTranslatedCosmetics, withTranslatedUserChallenges, withTranslatedUserCosmetics } from '../lib/translateContent.js';

const router = Router();

router.get('/api/cosmetics', async (req, res) => {
  try {
    const rows = await prisma.cosmetic.findMany({ orderBy: { price: 'asc' } });
    const cosmetics = await withTranslatedCosmetics(rows, req.query.lang);
    res.json(cosmetics);
  } catch (error) {
    res.status(500).json({ error: "Erreur lors de la récupération des cosmétiques" });
  }
});

// ─── ADMIN : gestion complète des cosmétiques ────────────────────────────────

router.post('/api/admin/cosmetics', isAdmin, async (req, res) => {
  const { name, description, type, imageUrl, price, rarity } = req.body;
  if (!name || !description || !type || price == null || !rarity) {
    return res.status(400).json({ error: "Champs requis manquants" });
  }
  try {
    const created = await prisma.cosmetic.create({
      data: { name, description, type, imageUrl: imageUrl || null, price: Number(price), rarity },
    });
    res.json(created);
  } catch (error) {
    res.status(400).json({ error: "Impossible de créer le cosmétique" });
  }
});

router.put('/api/admin/cosmetics/:id', isAdmin, async (req, res) => {
  const { name, description, type, imageUrl, price, rarity } = req.body;
  try {
    const updated = await prisma.cosmetic.update({
      where: { id: Number(req.params.id) },
      data: { name, description, type, imageUrl: imageUrl || null, price: price != null ? Number(price) : undefined, rarity },
    });
    res.json(updated);
  } catch (error) {
    res.status(400).json({ error: "Impossible de mettre à jour le cosmétique" });
  }
});

router.delete('/api/admin/cosmetics/:id', isAdmin, async (req, res) => {
  try {
    await prisma.cosmetic.delete({ where: { id: Number(req.params.id) } });
    res.json({ message: 'Cosmétique supprimé' });
  } catch (error) {
    res.status(400).json({ error: "Impossible de supprimer ce cosmétique" });
  }
});

router.post('/api/cosmetics/:id/buy', async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'Token manquant' });
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, SECRET);
    const cosmeticId = Number(req.params.id);
    const [cosmetic, user, existing] = await Promise.all([
      prisma.cosmetic.findUnique({ where: { id: cosmeticId } }),
      prisma.user.findUnique({ where: { id: decoded.userId } }),
      prisma.userCosmetic.findUnique({ where: { userId_cosmeticId: { userId: decoded.userId, cosmeticId } } }),
    ]);
    if (!cosmetic) return res.status(404).json({ error: "Cosmétique non trouvé" });
    if (user.coins < cosmetic.price) return res.status(400).json({ error: "Pas assez de coins" });
    if (existing) return res.status(400).json({ error: "Cosmétique déjà acheté" });
    await prisma.userCosmetic.create({ data: { userId: decoded.userId, cosmeticId } });
    const updatedUser = await prisma.user.update({
      where: { id: decoded.userId },
      data: { coins: { decrement: cosmetic.price } }
    });
    res.json({ message: "Cosmétique acheté !", user: sanitizeUser(updatedUser) });
  } catch (error) {
    res.status(400).json({ error: "Erreur lors de l'achat" });
  }
});

router.get('/api/users/me/cosmetics', async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'Token manquant' });
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, SECRET);
    const cosmetics = await prisma.userCosmetic.findMany({
      where: { userId: decoded.userId },
      include: { cosmetic: true }
    });
    res.json(cosmetics);
  } catch (error) {
    res.status(401).json({ error: 'Token invalide' });
  }
});

// Profil page: challenges + cosmétiques en une seule requête
router.get('/api/users/me/profile-data', authMiddleware, async (req, res) => {
  const userId = req.userId;
  try {
    const [challengeRows, total, totalCompleted, totalInProgress, cosmeticRows] = await Promise.all([
      prisma.userChallenge.findMany({
        where: { userId },
        include: { challenge: true },
        orderBy: { startedAt: 'desc' },
        take: 10,
      }),
      prisma.userChallenge.count({ where: { userId } }),
      prisma.userChallenge.count({ where: { userId, status: 'COMPLETED' } }),
      prisma.userChallenge.count({ where: { userId, status: 'IN_PROGRESS' } }),
      prisma.userCosmetic.findMany({ where: { userId }, include: { cosmetic: true } }),
    ]);
    const [challenges, cosmetics] = await Promise.all([
      withTranslatedUserChallenges(challengeRows, req.query.lang),
      withTranslatedUserCosmetics(cosmeticRows, req.query.lang),
    ]);
    res.json({
      challenges, total, totalCompleted, totalInProgress,
      hasMore: challenges.length === 10 && total > 10,
      cosmetics,
    });
  } catch (error) {
    res.status(500).json({ error: 'Erreur' });
  }
});

// ─── PROFIL PUBLIC ────────────────────────────────────────────────────────────

router.get('/api/users/:id/profile', async (req, res) => {
  try {
    const userId = Number(req.params.id);
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true, username: true, avatar: true, banner: true, bio: true,
        xp: true, level: true, createdAt: true,
        cosmetics: { where: { equipped: true }, include: { cosmetic: true } },
        _count: { select: { challenges: { where: { status: 'COMPLETED' } } } }
      }
    });
    if (!user) return res.status(404).json({ error: "Utilisateur non trouvé" });
    user.cosmetics = await withTranslatedUserCosmetics(user.cosmetics, req.query.lang);
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// ─── ÉQUIPEMENT COSMÉTIQUES ───────────────────────────────────────────────────

router.post('/api/users/me/cosmetics/:id/equip', async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'Token manquant' });
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, SECRET);
    const cosmeticId = Number(req.params.id);
    const userCosmetic = await prisma.userCosmetic.findUnique({
      where: { userId_cosmeticId: { userId: decoded.userId, cosmeticId } },
      include: { cosmetic: true }
    });
    if (!userCosmetic) return res.status(403).json({ error: "Vous ne possédez pas ce cosmétique" });

    if (userCosmetic.cosmetic.type === 'BADGE') {
      // Les badges supportent jusqu'à 3 équipés simultanément
      const equippedBadgeCount = await prisma.userCosmetic.count({
        where: { userId: decoded.userId, equipped: true, cosmetic: { type: 'BADGE' } },
      });
      if (equippedBadgeCount >= 3) {
        return res.status(400).json({ error: 'Maximum 3 badges équipés. Déséquipez un badge d\'abord.' });
      }
    } else {
      // Pour les autres types : déséquiper tous les cosmétiques du même type
      await prisma.userCosmetic.updateMany({
        where: { userId: decoded.userId, cosmetic: { type: userCosmetic.cosmetic.type } },
        data: { equipped: false }
      });
    }

    // Équiper le cosmétique demandé
    await prisma.userCosmetic.update({
      where: { userId_cosmeticId: { userId: decoded.userId, cosmeticId } },
      data: { equipped: true }
    });
    res.json({ success: true });
  } catch (error) {
    console.error('[equip]', error);
    res.status(400).json({ error: "Erreur lors de l'équipement" });
  }
});

router.post('/api/users/me/cosmetics/:id/unequip', async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'Token manquant' });
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, SECRET);
    const cosmeticId = Number(req.params.id);
    await prisma.userCosmetic.update({
      where: { userId_cosmeticId: { userId: decoded.userId, cosmeticId } },
      data: { equipped: false }
    });
    res.json({ success: true });
  } catch (error) {
    res.status(400).json({ error: "Erreur lors du déséquipement" });
  }
});

export default router;
