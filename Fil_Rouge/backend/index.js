import express from 'express';
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import multer from 'multer';
import path from 'path';
import jwt from 'jsonwebtoken';
import cors from 'cors';
import Groq from 'groq-sdk';

const app = express();
const prisma = new PrismaClient();

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static('uploads'));

const SECRET = process.env.JWT_SECRET || 'supersecret';
const DEFAULT_AVATAR = '/default-avatar.svg';

// ─── STREAK ──────────────────────────────────────────────────────────────────

const STREAK_MILESTONES = [
  { days: 7,   coins: 100,  xp: 200,  label: '7 jours de streak !' },
  { days: 14,  coins: 250,  xp: 500,  label: '14 jours de streak !' },
  { days: 30,  coins: 700,  xp: 1500, label: '30 jours de streak !', cosmeticName: 'Cadre Flamme' },
  { days: 60,  coins: 1500, xp: 3000, label: '60 jours de streak !' },
  { days: 100, coins: 3000, xp: 5000, label: '100 jours de streak !', cosmeticName: 'Cadre Légendaire' },
];

function getStreakMultiplier(streak) {
  return Math.min(3, Math.round((1 + Math.floor(streak / 7) * 0.05) * 100) / 100);
}

function getMilestoneReward(oldStreak, newStreak) {
  for (const m of STREAK_MILESTONES) {
    if (oldStreak < m.days && newStreak >= m.days) return m;
  }
  return null;
}

async function updateStreak(userId) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return null;

  const todayUTC = new Date();
  todayUTC.setUTCHours(0, 0, 0, 0);

  const last = user.lastStreakDate ? new Date(user.lastStreakDate) : null;
  if (last) last.setUTCHours(0, 0, 0, 0);

  const diffDays = last ? Math.round((todayUTC - last) / 86_400_000) : -1;

  // Already updated today — return without change
  if (diffDays === 0) return { user, streakUpdated: false, milestone: null };

  const oldStreak = user.currentStreak;
  const newStreak = diffDays === 1 ? oldStreak + 1 : 1; // continue or reset
  const longestStreak = Math.max(user.longestStreak, newStreak);
  const milestone = getMilestoneReward(oldStreak, newStreak);

  const updateData = {
    currentStreak: newStreak,
    longestStreak,
    lastStreakDate: todayUTC,
    ...(milestone ? { coins: { increment: milestone.coins }, xp: { increment: milestone.xp } } : {}),
  };

  // Recalculate level if XP added
  if (milestone) {
    const newXp = user.xp + milestone.xp;
    updateData.xp = newXp;
    updateData.level = Math.floor(newXp / 1000) + 1;
    delete updateData.xp; // remove duplicate key, re-add properly
    updateData.xp = newXp;
    updateData.level = Math.floor(newXp / 1000) + 1;
  }

  const updated = await prisma.user.update({ where: { id: userId }, data: updateData });

  // Auto-award cosmetic at milestone
  if (milestone?.cosmeticName) {
    const cosmetic = await prisma.cosmetic.findFirst({ where: { name: milestone.cosmeticName } });
    if (cosmetic) {
      const alreadyOwned = await prisma.userCosmetic.findUnique({
        where: { userId_cosmeticId: { userId, cosmeticId: cosmetic.id } }
      });
      if (!alreadyOwned) {
        await prisma.userCosmetic.create({ data: { userId, cosmeticId: cosmetic.id } });
      }
    }
  }

  return { user: updated, streakUpdated: true, newStreak, milestone };
}

app.post('/api/auth/register', async (req, res) => {
  const { username, email, password, avatar } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email et mot de passe requis.' });
  try {
    const hashed = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        username,
        email,
        password: hashed,
        avatar: avatar || DEFAULT_AVATAR
      }
    });
    const token = jwt.sign({ userId: user.id }, SECRET, { expiresIn: '1d' });
    res.json({ message: 'Utilisateur créé', token, user });
  } catch (error) {
    res.status(400).json({ error: 'Utilisateur ou email déjà pris.' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email et mot de passe requis.' });
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !(await bcrypt.compare(password, user.password))) {
    return res.status(401).json({ error: 'Email ou mot de passe incorrect' });
  }
  const token = jwt.sign({ userId: user.id }, SECRET, { expiresIn: '1d' });
  res.json({ token, user: { ...user, avatar: user.avatar || DEFAULT_AVATAR } });
});

app.get('/users', async (req, res) => {
  const users = await prisma.user.findMany();
  res.json(users);
});

app.post('/users', async (req, res) => {
  const { email, name, password } = req.body;
  const user = await prisma.user.create({
    data: { email, name, password }
  });
  res.json(user);
});

app.get('/api/users/me', async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ user: null });
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, SECRET);
    const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
    if (!user) return res.status(404).json({ user: null });
    res.json({ user: { ...user, avatar: user.avatar || DEFAULT_AVATAR } });
  } catch (err) {
    return res.status(401).json({ user: null });
  }
});

app.put('/api/users/me', async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'Token manquant' });
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, SECRET);
    const userId = decoded.userId;
    const { username, email, bio, avatar, banner } = req.body;
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { username, email, bio, avatar, banner }
    });
    res.json({ user: { ...updatedUser, avatar: updatedUser.avatar || DEFAULT_AVATAR } });
  } catch (err) {
    return res.status(401).json({ error: 'Token invalide' });
  }
});

app.put('/api/users/:id', async (req, res) => {
  const { id } = req.params;
  const { username, email, bio, avatar, banner, isAdmin } = req.body;
  try {
    const updatedUser = await prisma.user.update({
      where: { id: Number(id) || id },
      data: { username, email, bio, avatar, banner, isAdmin }
    });
    res.json({ user: updatedUser });
  } catch (err) {
    res.status(400).json({ error: "Impossible de mettre à jour l'utilisateur" });
  }
});

app.put('/api/users/me/password', async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'Token manquant' });
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, SECRET);
    const userId = decoded.userId;
    const { currentPassword, newPassword } = req.body;
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return res.status(404).json({ error: 'Utilisateur non trouvé' });
    const valid = await bcrypt.compare(currentPassword, user.password);
    if (!valid) return res.status(400).json({ error: 'Mot de passe actuel incorrect' });
    const hashed = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({
      where: { id: userId },
      data: { password: hashed }
    });
    res.json({ message: 'Mot de passe mis à jour' });
  } catch (err) {
    res.status(401).json({ error: 'Token invalide' });
  }
});

// Recherche d'utilisateurs par pseudo — doit être AVANT /api/users/:id
app.get('/api/users/search', authMiddleware, async (req, res) => {
  const q = (req.query.q ?? '').trim();
  if (!q || q.length < 2) return res.json([]);
  try {
    const users = await prisma.user.findMany({
      where: {
        username: { contains: q, mode: 'insensitive' },
        id: { not: req.userId },
      },
      select: { id: true, username: true, avatar: true, level: true, xp: true, currentStreak: true },
      take: 20,
      orderBy: { username: 'asc' },
    });
    const friendships = users.length === 0 ? [] : await prisma.friend.findMany({
      where: {
        OR: [
          { senderId: req.userId, receiverId: { in: users.map(u => u.id) } },
          { receiverId: req.userId, senderId: { in: users.map(u => u.id) } },
        ]
      }
    });
    const result = users.map(u => {
      const row = friendships.find(f => f.senderId === u.id || f.receiverId === u.id);
      return {
        ...u,
        friendStatus: row ? row.status : 'NONE',
        friendshipId: row?.id ?? null,
        isSender: row ? row.senderId === req.userId : null,
      };
    });
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Erreur lors de la recherche' });
  }
});

app.get('/api/users/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const user = await prisma.user.findUnique({
      where: { id: Number(id) || id }
    });
    if (!user) return res.status(404).json({ error: "Utilisateur non trouvé" });
    res.json({ user });
  } catch (err) {
    res.status(400).json({ error: "Erreur lors de la récupération de l'utilisateur" });
  }
});

app.get('/api/topics', async (req, res) => {
  try {
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 20));
    const skip  = Math.max(0, parseInt(req.query.skip) || 0);
    const topics = await prisma.topic.findMany({
      include: {
        user: { select: { id: true, username: true, avatar: true } },
        _count: { select: { posts: true } }
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip,
    });
    res.json(topics);
  } catch (error) {
    res.status(500).json({ error: "Erreur lors de la récupération des topics" });
  }
});

app.get('/api/topics/:id', async (req, res) => {
  const id = Number(req.params.id);
  try {
    const topic = await prisma.topic.findUnique({
      where: { id },
      include: {
        user: true,
        posts: true,
        _count: { select: { posts: true } }
      }
    });
    if (!topic) return res.status(404).json({ error: "Topic non trouvé" });
    res.json(topic);
  } catch (error) {
    res.status(400).json({ error: "Erreur lors de la récupération du topic" });
  }
});

app.post('/api/topics', async (req, res) => {
  const { title, content, game, category, tags, createdBy } = req.body;
  if (!title || !content || !game || !category || !createdBy) {
    return res.status(400).json({ error: "Champs requis manquants" });
  }
  try {
    const tagsString = Array.isArray(tags) ? JSON.stringify(tags) : tags || null;
    const topic = await prisma.topic.create({
      data: {
        title,
        content,
        game,
        category,
        tags: tagsString,
        createdBy: Number(createdBy)
      }
    });
    res.json(topic);
  } catch (error) {
    res.status(400).json({ error: "Erreur lors de la création du topic" });
  }
});

app.put('/api/topics/:id', async (req, res) => {
  const { id } = req.params;
  const { title, content, tags, userId } = req.body;
  try {
    const topic = await prisma.topic.findUnique({ where: { id: Number(id) } });
    if (!topic) return res.status(404).json({ error: "Topic non trouvé" });
    if (topic.createdBy !== Number(userId)) return res.status(403).json({ error: "Non autorisé" });
    const tagsString = Array.isArray(tags) ? JSON.stringify(tags) : tags || null;
    const updated = await prisma.topic.update({
      where: { id: Number(id) },
      data: { title, content, tags: tagsString }
    });
    res.json(updated);
  } catch (error) {
    res.status(400).json({ error: "Erreur lors de la modification du topic" });
  }
});

app.delete('/api/topics/:id/:userId', async (req, res) => {
  const { id, userId } = req.params;
  try {
    const topic = await prisma.topic.findUnique({ where: { id: Number(id) } });
    if (!topic) return res.status(404).json({ error: "Topic non trouvé" });
    if (topic.createdBy !== Number(userId)) return res.status(403).json({ error: "Non autorisé" });
    await prisma.topic.delete({ where: { id: Number(id) } });
    res.json({ message: "Topic supprimé" });
  } catch (error) {
    res.status(400).json({ error: "Erreur lors de la suppression du topic" });
  }
});

app.get('/api/posts', async (req, res) => {
  try {
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 50));
    const skip  = Math.max(0, parseInt(req.query.skip) || 0);
    const posts = await prisma.post.findMany({
      include: { user: { select: { id: true, username: true, avatar: true } }, topic: { select: { id: true, title: true } } },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip,
    });
    res.json(posts);
  } catch (error) {
    res.status(500).json({ error: "Erreur lors de la récupération des posts" });
  }
});

app.get('/api/topics/:topicId/posts', async (req, res) => {
  const { topicId } = req.params;
  try {
    const posts = await prisma.post.findMany({
      where: { topicId: Number(topicId) },
      include: { user: { select: { id: true, username: true, avatar: true } } },
      orderBy: { createdAt: 'asc' },
      take: 100,
    });
    res.json(posts);
  } catch (error) {
    res.status(500).json({ error: "Erreur lors de la récupération des posts du topic" });
  }
});

app.post('/api/topics/:topicId/posts', async (req, res) => {
  const { topicId } = req.params;
  const { content, createdBy } = req.body;
  if (!content || !createdBy) return res.status(400).json({ error: "Champs requis manquants" });
  try {
    const post = await prisma.post.create({
      data: {
        content,
        topicId: Number(topicId),
        createdBy: Number(createdBy)
      }
    });
    res.json(post);
  } catch (error) {
    res.status(400).json({ error: "Erreur lors de la création du post" });
  }
});

app.delete('/api/posts/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await prisma.post.delete({ where: { id: Number(id) } });
    res.json({ message: "Post supprimé" });
  } catch (error) {
    res.status(400).json({ error: "Erreur lors de la suppression du post" });
  }
});

app.post('/api/topics/:id/like', async (req, res) => {
  const topicId = Number(req.params.id);
  const userId = Number(req.body.userId);
  if (!userId) return res.status(400).json({ error: "userId requis" });

  try {
    const topic = await prisma.topic.findUnique({ where: { id: topicId } });
    if (!topic) return res.status(404).json({ error: "Topic non trouvé" });

    const existing = await prisma.like.findUnique({
      where: { userId_topicId: { userId, topicId } }
    });

    if (existing) {
      await prisma.like.delete({
        where: { userId_topicId: { userId, topicId } }
      });
      await prisma.topic.update({
        where: { id: topicId },
        data: { likes: { decrement: 1 } }
      });
      return res.json({ liked: false });
    } else {
      await prisma.like.create({
        data: { userId, topicId }
      });
      await prisma.topic.update({
        where: { id: topicId },
        data: { likes: { increment: 1 } }
      });
      return res.json({ liked: true });
    }
  } catch (error) {
    res.status(500).json({ error: "Erreur lors du like/unlike" });
  }
});

app.get('/api/topics/:id/like', async (req, res) => {
  const topicId = Number(req.params.id);
  const userId = Number(req.query.userId);
  if (!userId) return res.status(400).json({ error: "userId requis" });

  try {
    const like = await prisma.like.findUnique({
      where: { userId_topicId: { userId, topicId } }
    });
    res.json({ liked: !!like });
  } catch (error) {
    res.status(500).json({ error: "Erreur lors de la vérification du like" });
  }
});

app.get('/api/likes', async (req, res) => {
  try {
    const likes = await prisma.like.findMany({
      include: {
        user: { select: { id: true, username: true } },
        topic: { select: { id: true, title: true } }
      }
    });
    res.json(likes);
  } catch (error) {
    res.status(500).json({ error: "Erreur lors de la récupération des likes" });
  }
});

const upload = multer({ dest: 'uploads/', limits: { fileSize: 5 * 1024 * 1024 } });

app.post('/api/upload', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Aucun fichier' });
  res.json({ url: `/uploads/${req.file.filename}` });
});

app.get('/uploads/:filename', (req, res) => {
  const filePath = path.join(process.cwd(), 'uploads', req.params.filename);
  res.sendFile(filePath);
});

const port = process.env.PORT || 3001;
app.listen(port, () => {
  console.log(`Serveur backend lancé sur http://localhost:${port}`);
});

app.delete('/api/users/:id', async (req, res) => {
  try {
    await prisma.user.delete({ where: { id: Number(req.params.id) } });
    res.json({ message: "Utilisateur supprimé" });
  } catch (error) {
    res.status(400).json({ error: "Erreur lors de la suppression de l'utilisateur" });
  }
});

app.delete('/api/topics/:id', async (req, res) => {
  try {
    await prisma.topic.delete({ where: { id: Number(req.params.id) } });
    res.json({ message: "Topic supprimé" });
  } catch (error) {
    res.status(400).json({ error: "Erreur lors de la suppression du topic" });
  }
});

app.delete('/api/posts/:id', async (req, res) => {
  try {
    await prisma.post.delete({ where: { id: Number(req.params.id) } });
    res.json({ message: "Post supprimé" });
  } catch (error) {
    res.status(400).json({ error: "Erreur lors de la suppression du post" });
  }
});

app.post('/api/discussions', async (req, res) => {
  const {
    title,
    content,
    game,
    category,
    tags,
    createdAt,
    createdBy
  } = req.body;

  try {
    if (
      !title ||
      !content ||
      !game ||
      !category ||
      !createdBy
    ) {
      return res.status(400).json({ error: "Champs obligatoires manquants" });
    }

    const tagsString = Array.isArray(tags) ? JSON.stringify(tags) : tags || null;

    const topic = await prisma.topic.create({
      data: {
        title,
        content,
        game,
        category,
        tags: tagsString,
        createdAt: createdAt ? new Date(createdAt) : new Date(),
        createdBy: Number(createdBy)
      }
    });

    res.json(topic);
  } catch (error) {
    res.status(400).json({ error: "Erreur lors de la création de la discussion" });
  }
});

app.get('/api/discussions', async (req, res) => {
  try {
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 20));
    const skip  = Math.max(0, parseInt(req.query.skip) || 0);
    const topics = await prisma.topic.findMany({
      include: {
        user: {
          select: {
            id: true, username: true, avatar: true,
            cosmetics: { where: { equipped: true }, select: { equipped: true, cosmeticId: true, cosmetic: { select: { id: true, name: true, type: true, rarity: true, imageUrl: true } } } }
          }
        },
        _count: { select: { posts: true } }
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip,
    });
    const topicsWithTags = topics.map(topic => {
      let tags = [];
      if (Array.isArray(topic.tags)) {
        tags = topic.tags;
      } else if (typeof topic.tags === "string") {
        try {
          const parsed = JSON.parse(topic.tags);
          if (Array.isArray(parsed)) {
            tags = parsed.map(tag =>
              typeof tag === "string"
                ? { name: tag, color: "#3B82F6" }
                : tag
            );
          }
        } catch {
          tags = [{ name: topic.tags, color: "#3B82F6" }];
        }
      }
      return { ...topic, tags };
    });
    res.json(topicsWithTags);
  } catch (error) {
    res.status(500).json({ error: "Erreur lors de la récupération des discussions" });
  }
});

app.get('/api/topics/:topicId/messages', async (req, res) => {
  const { topicId } = req.params;
  try {
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit) || 100));
    const skip  = Math.max(0, parseInt(req.query.skip) || 0);
    const messages = await prisma.post.findMany({
      where: { topicId: Number(topicId) },
      include: { user: { include: { cosmetics: { where: { equipped: true }, include: { cosmetic: true } } } } },
      orderBy: { createdAt: 'asc' },
      take: limit,
      skip,
    });
    res.json(messages);
  } catch (error) {
    res.status(500).json({ error: "Erreur lors de la récupération des messages" });
  }
});

app.post('/api/topics/:topicId/messages', async (req, res) => {
  const { topicId } = req.params;
  const { content, createdBy } = req.body;

  if (!content || !createdBy) {
    return res.status(400).json({ error: "Missing content or createdBy" });
  }
  try {
    const message = await prisma.post.create({
      data: {
        content,
        topicId: Number(topicId),      
        createdBy: Number(createdBy),  
        createdAt: new Date()
      },
      include: { user: true }
    });
    res.json(message);
  } catch (error) {
    res.status(500).json({ error: "Erreur lors de la création du message" });
  }
});

function isAdmin(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'Token manquant' });
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, SECRET);
    prisma.user.findUnique({ where: { id: decoded.userId } }).then(user => {
      if (!user || !user.isAdmin) {
        return res.status(403).json({ error: 'Accès refusé' });
      }
      req.user = user;
      next();
    });
  } catch (err) {
    return res.status(401).json({ error: 'Token invalide' });
  }
}

app.delete('/api/likes/:id', async (req, res) => {
  try {
    await prisma.like.delete({ where: { id: Number(req.params.id) } });
    res.json({ message: "Like supprimé" });
  } catch (error) {
    res.status(400).json({ error: "Erreur lors de la suppression du like" });
  }
});

app.get('/api/users/:id/topics', async (req, res) => {
  const userId = req.params.id;
  const topics = await prisma.topic.findMany({
    where: { createdBy: Number(userId) },
    select: { id: true, title: true, category: true, createdAt: true, likes: true, _count: { select: { posts: true } } },
    orderBy: { createdAt: 'desc' },
    take: 20,
  });
  res.json(topics);
});

// ─── DÉFIS ───────────────────────────────────────────────────────────────────

const DAILY_BONUS_MULTIPLIER = 1.5;

async function getDailyChallenge() {
  const count = await prisma.challenge.count({ where: { isPublic: true } });
  if (count === 0) return null;
  const today = new Date();
  const seed = today.getUTCFullYear() * 10000 + (today.getUTCMonth() + 1) * 100 + today.getUTCDate();
  const idx = seed % count;
  const rows = await prisma.challenge.findMany({
    where: { isPublic: true },
    orderBy: { id: 'asc' },
    skip: idx,
    take: 1,
  });
  return rows[0] ?? null;
}

app.get('/api/challenges', async (req, res) => {
  try {
    const { category, difficulty, search } = req.query;
    const skip  = Math.max(0, parseInt(req.query.skip)  || 0);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 10));
    const authHeader = req.headers.authorization;
    let currentUserId = null;
    if (authHeader) {
      try { currentUserId = jwt.verify(authHeader.split(' ')[1], SECRET).userId; } catch {}
    }
    const visibilityClause = currentUserId
      ? { OR: [{ isPublic: true }, { createdBy: currentUserId }] }
      : { isPublic: true };

    const where = {
      ...visibilityClause,
      ...(category   ? { category }                       : {}),
      ...(difficulty ? { difficulty }                     : {}),
      ...(search     ? { title: { contains: search } }   : {}),
    };
    const [challenges, total] = await Promise.all([
      prisma.challenge.findMany({
        where,
        include: {
          creator: { select: { id: true, username: true, avatar: true } },
          _count: { select: { participants: true } }
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit
      }),
      prisma.challenge.count({ where })
    ]);
    res.json({ challenges, total, hasMore: skip + challenges.length < total });
  } catch (error) {
    res.status(500).json({ error: "Erreur lors de la récupération des défis" });
  }
});

app.get('/api/challenges/daily-suggestion', async (req, res) => {
  try {
    const daily = await getDailyChallenge();
    if (!daily) return res.json(null);
    const full = await prisma.challenge.findUnique({
      where: { id: daily.id },
      include: { creator: { select: { id: true, username: true, avatar: true } } }
    });
    res.json({ ...full, dailyBonusMultiplier: DAILY_BONUS_MULTIPLIER });
  } catch (error) {
    res.status(500).json({ error: "Erreur lors de la récupération du défi du jour" });
  }
});

app.get('/api/challenges/:id', async (req, res) => {
  try {
    const challenge = await prisma.challenge.findUnique({
      where: { id: Number(req.params.id) },
      include: {
        creator: { select: { id: true, username: true, avatar: true } },
        _count: { select: { participants: true } }
      }
    });
    if (!challenge) return res.status(404).json({ error: "Défi non trouvé" });
    res.json(challenge);
  } catch (error) {
    res.status(400).json({ error: "Erreur lors de la récupération du défi" });
  }
});

app.post('/api/challenges', async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'Token manquant' });
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, SECRET);
    const { title, description, difficulty, category, isPublic } = req.body;
    if (!title || !description || !difficulty || !category) {
      return res.status(400).json({ error: "Champs requis manquants" });
    }
    const rewards = { EASY: { coins: 50, xp: 100 }, MEDIUM: { coins: 150, xp: 300 }, HARD: { coins: 350, xp: 700 }, EXPERT: { coins: 700, xp: 1500 } };
    const r = rewards[difficulty] || rewards.EASY;
    const challenge = await prisma.challenge.create({
      data: { title, description, difficulty, category, coinReward: r.coins, xpReward: r.xp, createdBy: decoded.userId, isPublic: isPublic !== false }
    });
    res.json(challenge);
  } catch (error) {
    res.status(400).json({ error: "Erreur lors de la création du défi" });
  }
});

app.post('/api/challenges/:id/start', async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'Token manquant' });
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, SECRET);
    const challengeId = Number(req.params.id);
    const existing = await prisma.userChallenge.findUnique({
      where: { userId_challengeId: { userId: decoded.userId, challengeId } }
    });
    if (existing) return res.status(400).json({ error: "Défi déjà commencé" });
    const uc = await prisma.userChallenge.create({
      data: { userId: decoded.userId, challengeId, status: 'IN_PROGRESS' }
    });
    res.json(uc);
  } catch (error) {
    res.status(400).json({ error: "Erreur lors du démarrage du défi" });
  }
});

app.post('/api/challenges/:id/complete', async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'Token manquant' });
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, SECRET);
    const challengeId = Number(req.params.id);
    const uc = await prisma.userChallenge.findUnique({
      where: { userId_challengeId: { userId: decoded.userId, challengeId } }
    });
    if (!uc) return res.status(404).json({ error: "Défi non commencé" });
    if (uc.status === 'COMPLETED') return res.status(400).json({ error: "Défi déjà complété" });
    const challenge = await prisma.challenge.findUnique({ where: { id: challengeId } });
    await prisma.userChallenge.update({
      where: { id: uc.id },
      data: { status: 'COMPLETED', completedAt: new Date() }
    });
    const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
    let streakResult = null;
    try { streakResult = await updateStreak(decoded.userId); } catch {}
    const freshUser = streakResult?.user ?? user;
    const multiplier = getStreakMultiplier(freshUser?.currentStreak ?? 0);
    const dailyChallenge = await getDailyChallenge();
    const isDailyBonus = dailyChallenge?.id === challengeId;
    const dailyMultiplier = isDailyBonus ? DAILY_BONUS_MULTIPLIER : 1;
    const coinsEarned = Math.floor(challenge.coinReward * multiplier * dailyMultiplier);
    const xpEarned = Math.floor(challenge.xpReward * multiplier * dailyMultiplier);
    const newXp = freshUser.xp + xpEarned;
    const newLevel = Math.floor(newXp / 1000) + 1;
    const updatedUser = await prisma.user.update({
      where: { id: decoded.userId },
      data: { coins: { increment: coinsEarned }, xp: newXp, level: newLevel }
    });
    res.json({
      message: "Défi complété !",
      coinsEarned, xpEarned, multiplier,
      isDailyBonus, dailyMultiplier,
      streak: { current: freshUser.currentStreak, milestone: streakResult?.milestone ?? null },
      user: updatedUser
    });
  } catch (error) {
    res.status(400).json({ error: "Erreur lors de la complétion du défi" });
  }
});

app.get('/api/users/me/challenges', async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'Token manquant' });
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, SECRET);
    const skip   = Math.max(0, parseInt(req.query.skip)  || 0);
    const limit  = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    const status = req.query.status; // optional: 'IN_PROGRESS' | 'COMPLETED'
    const where  = { userId: decoded.userId, ...(status ? { status } : {}) };

    const [challenges, total, totalCompleted, totalInProgress] = await Promise.all([
      prisma.userChallenge.findMany({
        where,
        include: { challenge: true },
        orderBy: { startedAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.userChallenge.count({ where: { userId: decoded.userId } }),
      prisma.userChallenge.count({ where: { userId: decoded.userId, status: 'COMPLETED' } }),
      prisma.userChallenge.count({ where: { userId: decoded.userId, status: 'IN_PROGRESS' } }),
    ]);
    res.json({ challenges, total, totalCompleted, totalInProgress, hasMore: skip + challenges.length < total });
  } catch (error) {
    res.status(401).json({ error: 'Token invalide' });
  }
});

// ─── IA GÉNÉRATION DE DÉFIS ──────────────────────────────────────────────────

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
console.log('[AI] Groq API key:', process.env.GROQ_API_KEY ? `chargée (${process.env.GROQ_API_KEY.slice(0, 8)}...)` : '❌ MANQUANTE');

const AI_SYSTEM_PROMPT = `Tu es un assistant de création de défis personnalisés pour une application de gamification.

PROCESSUS:
1. L'utilisateur décrit son objectif
2. Tu peux poser au maximum 2 questions de suivi, une à la fois, pour mieux cerner ses besoins
3. Dès que tu as assez d'informations, génère les défis

NOMBRE DE DÉFIS À GÉNÉRER:
- Programme sur N jours → N défis (un par jour, nommés "Jour 1:", "Jour 2:", etc.)
- Sans durée précisée → 5 défis variés

CATÉGORIES (utilise EXACTEMENT ces valeurs):
GAMING, SPORT, CUISINE, FITNESS, CREATIVITY, KNOWLEDGE, SOCIAL, NATURE, MUSIC, WELLNESS, DIY, OTHERS

Correspondances:
- Jardinage, plein air, écologie, randonnée → NATURE
- Instrument, chant, composition → MUSIC
- Méditation, bien-être, sommeil, stress → WELLNESS
- Bricolage, artisanat, forgeron, menuiserie, couture → DIY
- Tout le reste → OTHERS

DIFFICULTÉS (utilise EXACTEMENT ces valeurs): EASY, MEDIUM, HARD, EXPERT

Titres: max 80 caractères. Descriptions: max 500 caractères, claires et actionnables.

FORMAT DE RÉPONSE — JSON uniquement, rien d'autre:
Question: {"type":"question","content":"Ta question"}
Défis: {"type":"challenges","challenges":[{"title":"...","description":"...","category":"...","difficulty":"..."}]}`;

app.post('/api/challenges/ai-generate', async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'Token manquant' });
  const { history } = req.body;
  if (!history || !Array.isArray(history) || history.length === 0) {
    return res.status(400).json({ error: 'Historique de conversation requis' });
  }
  try {
    jwt.verify(authHeader.split(' ')[1], SECRET);
    const response = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      max_tokens: 2048,
      messages: [
        { role: 'system', content: AI_SYSTEM_PROMPT },
        ...history.map(m => ({ role: m.role, content: m.content })),
      ],
    });
    const text = response.choices[0].message.content.trim();
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    try {
      const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : text);
      res.json(parsed);
    } catch {
      res.json({ type: 'question', content: text });
    }
  } catch (error) {
    console.error('AI generation error:', error);
    res.status(500).json({ error: 'Erreur lors de la génération par IA' });
  }
});

app.post('/api/challenges/bulk-save', async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'Token manquant' });
  const token = authHeader.split(' ')[1];
  const { challenges } = req.body;
  if (!challenges || !Array.isArray(challenges) || challenges.length === 0) {
    return res.status(400).json({ error: 'Défis requis' });
  }
  try {
    const decoded = jwt.verify(token, SECRET);
    const rewards = { EASY: { coins: 50, xp: 100 }, MEDIUM: { coins: 150, xp: 300 }, HARD: { coins: 350, xp: 700 }, EXPERT: { coins: 700, xp: 1500 } };
    const created = await Promise.all(
      challenges.map(({ title, description, difficulty, category, isPublic }) => {
        const r = rewards[difficulty] || rewards.EASY;
        return prisma.challenge.create({
          data: {
            title,
            description,
            difficulty,
            category,
            coinReward: r.coins,
            xpReward: r.xp,
            createdBy: decoded.userId,
            isPublic: isPublic !== false,
            participants: {
              create: {
                userId: decoded.userId,
                status: 'IN_PROGRESS'
              }
            }
          }
        });
      })
    );
    res.json(created);
  } catch (error) {
    res.status(400).json({ error: 'Erreur lors de la sauvegarde des défis' });
  }
});

// ─── BOUTIQUE / COSMÉTIQUES ──────────────────────────────────────────────────

app.get('/api/cosmetics', async (req, res) => {
  try {
    const cosmetics = await prisma.cosmetic.findMany({ orderBy: { price: 'asc' } });
    res.json(cosmetics);
  } catch (error) {
    res.status(500).json({ error: "Erreur lors de la récupération des cosmétiques" });
  }
});

app.post('/api/cosmetics/:id/buy', async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'Token manquant' });
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, SECRET);
    const cosmeticId = Number(req.params.id);
    const cosmetic = await prisma.cosmetic.findUnique({ where: { id: cosmeticId } });
    if (!cosmetic) return res.status(404).json({ error: "Cosmétique non trouvé" });
    const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
    if (user.coins < cosmetic.price) return res.status(400).json({ error: "Pas assez de coins" });
    const existing = await prisma.userCosmetic.findUnique({
      where: { userId_cosmeticId: { userId: decoded.userId, cosmeticId } }
    });
    if (existing) return res.status(400).json({ error: "Cosmétique déjà acheté" });
    await prisma.userCosmetic.create({ data: { userId: decoded.userId, cosmeticId } });
    const updatedUser = await prisma.user.update({
      where: { id: decoded.userId },
      data: { coins: { decrement: cosmetic.price } }
    });
    res.json({ message: "Cosmétique acheté !", user: updatedUser });
  } catch (error) {
    res.status(400).json({ error: "Erreur lors de l'achat" });
  }
});

app.get('/api/users/me/cosmetics', async (req, res) => {
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

// ─── PROFIL PUBLIC ────────────────────────────────────────────────────────────

app.get('/api/users/:id/profile', async (req, res) => {
  try {
    const userId = Number(req.params.id);
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true, username: true, avatar: true, banner: true, bio: true,
        xp: true, level: true, createdAt: true,
        cosmetics: { where: { equipped: true }, include: { cosmetic: true } },
        _count: { select: { challenges: true } }
      }
    });
    if (!user) return res.status(404).json({ error: "Utilisateur non trouvé" });
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// ─── ÉQUIPEMENT COSMÉTIQUES ───────────────────────────────────────────────────

app.post('/api/users/me/cosmetics/:id/equip', async (req, res) => {
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
      const sameTypeCosmetics = await prisma.cosmetic.findMany({
        where: { type: userCosmetic.cosmetic.type },
        select: { id: true }
      });
      const sameTypeIds = sameTypeCosmetics.map(c => c.id);
      await prisma.userCosmetic.updateMany({
        where: { userId: decoded.userId, cosmeticId: { in: sameTypeIds } },
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
    res.status(400).json({ error: String(error?.message ?? "Erreur lors de l'équipement") });
  }
});

app.post('/api/users/me/cosmetics/:id/unequip', async (req, res) => {
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

// ─── CLASSEMENT ───────────────────────────────────────────────────────────────

const LEADERBOARD_SELECT = {
  id: true, username: true, avatar: true, coins: true, xp: true, level: true,
  currentStreak: true, longestStreak: true,
  _count: { select: { challenges: true } },
  cosmetics: {
    where: { equipped: true },
    select: { cosmeticId: true, equipped: true, cosmetic: { select: { id: true, name: true, type: true, rarity: true, imageUrl: true } } }
  }
};

app.get('/api/leaderboard', async (req, res) => {
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

app.get('/api/leaderboard/friends', authMiddleware, async (req, res) => {
  try {
    const friendships = await prisma.friend.findMany({
      where: { OR: [{ senderId: req.userId }, { receiverId: req.userId }], status: 'ACCEPTED' }
    });
    const friendIds = friendships.map(f => f.senderId === req.userId ? f.receiverId : f.senderId);
    const users = await prisma.user.findMany({
      where: { id: { in: [...friendIds, req.userId] } },
      select: LEADERBOARD_SELECT,
      orderBy: { currentStreak: 'desc' }
    });
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: 'Erreur lors de la récupération du classement amis' });
  }
});

// ─── AMIS ─────────────────────────────────────────────────────────────────────

function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'Token manquant' });
  try {
    req.userId = jwt.verify(authHeader.split(' ')[1], SECRET).userId;
    next();
  } catch { res.status(401).json({ error: 'Token invalide' }); }
}

// Envoyer une demande d'ami
app.post('/api/friends/request/:targetId', authMiddleware, async (req, res) => {
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
app.post('/api/friends/accept/:requestId', authMiddleware, async (req, res) => {
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
app.delete('/api/friends/:requestId', authMiddleware, async (req, res) => {
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
app.get('/api/friends', authMiddleware, async (req, res) => {
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
app.get('/api/friends/requests', authMiddleware, async (req, res) => {
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
app.get('/api/friends/status/:targetId', authMiddleware, async (req, res) => {
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

// ─── DÉFIS EN GROUPE ──────────────────────────────────────────────────────────

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

const GROUP_INCLUDE = {
  challenge: { select: { id: true, title: true, description: true, difficulty: true, category: true, coinReward: true, xpReward: true } },
  creator: { select: { id: true, username: true, avatar: true } },
  members: {
    include: { user: { select: { id: true, username: true, avatar: true } } },
    orderBy: { invitedAt: 'asc' }
  },
  messages: {
    include: { user: { select: { id: true, username: true, avatar: true } } },
    orderBy: { createdAt: 'asc' },
    take: 50
  }
};

// Créer un groupe et inviter des amis (max 4 membres au total)
app.post('/api/groups', authMiddleware, async (req, res) => {
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
    console.error('[groups] création:', error?.message ?? error);
    res.status(500).json({ error: error?.message ?? 'Erreur lors de la création du groupe' });
  }
});

// Mes groupes (comme créateur ou membre)
app.get('/api/groups', authMiddleware, async (req, res) => {
  try {
    const groups = await prisma.challengeGroup.findMany({
      where: { members: { some: { userId: req.userId } } },
      include: GROUP_INCLUDE,
      orderBy: { createdAt: 'desc' }
    });
    res.json(groups);
  } catch (error) {
    res.status(500).json({ error: 'Erreur lors de la récupération des groupes' });
  }
});

// Inviter des amis dans un groupe existant
app.post('/api/groups/:id/invite', authMiddleware, async (req, res) => {
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
app.post('/api/groups/:id/join', authMiddleware, async (req, res) => {
  const groupId = Number(req.params.id);
  try {
    const member = await prisma.challengeGroupMember.findUnique({
      where: { groupId_userId: { groupId, userId: req.userId } }
    });
    if (!member) return res.status(404).json({ error: 'Invitation introuvable' });
    if (member.status !== 'INVITED') return res.status(400).json({ error: 'Déjà rejoint' });
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
app.delete('/api/groups/:id/leave', authMiddleware, async (req, res) => {
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
app.post('/api/groups/:id/complete', authMiddleware, async (req, res) => {
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
    try { streakResult = await updateStreak(req.userId); } catch {}
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
app.get('/api/groups/:id/messages', authMiddleware, async (req, res) => {
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
app.post('/api/groups/:id/messages', authMiddleware, async (req, res) => {
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