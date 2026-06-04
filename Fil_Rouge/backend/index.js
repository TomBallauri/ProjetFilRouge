import express from 'express';
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import multer from 'multer';
import path from 'path';
import jwt from 'jsonwebtoken';
import cors from 'cors';
import Anthropic from '@anthropic-ai/sdk';

const app = express();
const prisma = new PrismaClient();

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static('uploads'));

const SECRET = process.env.JWT_SECRET || 'supersecret';
const DEFAULT_AVATAR = '/default-avatar.svg';

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
    const topics = await prisma.topic.findMany({
      include: {
        user: true,
        _count: { select: { posts: true } }
      },
      orderBy: { createdAt: 'desc' }
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
    const posts = await prisma.post.findMany({
      include: { user: true, topic: true },
      orderBy: { createdAt: 'desc' }
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
      include: { user: true },
      orderBy: { createdAt: 'asc' }
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
    const topics = await prisma.topic.findMany({
      include: {
        user: { include: { cosmetics: { where: { equipped: true }, include: { cosmetic: true } } } },
        _count: { select: { posts: true } }
      },
      orderBy: { createdAt: 'desc' }
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
    const messages = await prisma.post.findMany({
      where: { topicId: Number(topicId) },
      include: { user: { include: { cosmetics: { where: { equipped: true }, include: { cosmetic: true } } } } },
      orderBy: { createdAt: 'asc' }
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
  const topics = await prisma.topic.findMany({ where: { createdBy: Number(userId) } });
  res.json(topics);
});

// ─── DÉFIS ───────────────────────────────────────────────────────────────────

app.get('/api/challenges', async (req, res) => {
  try {
    const { category, difficulty, search } = req.query;
    const where = {};
    if (category) where.category = category;
    if (difficulty) where.difficulty = difficulty;
    if (search) where.title = { contains: search };
    const challenges = await prisma.challenge.findMany({
      where,
      include: {
        creator: { select: { id: true, username: true, avatar: true } },
        _count: { select: { participants: true } }
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(challenges);
  } catch (error) {
    res.status(500).json({ error: "Erreur lors de la récupération des défis" });
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
    const { title, description, difficulty, category } = req.body;
    if (!title || !description || !difficulty || !category) {
      return res.status(400).json({ error: "Champs requis manquants" });
    }
    const rewards = { EASY: { coins: 50, xp: 100 }, MEDIUM: { coins: 150, xp: 300 }, HARD: { coins: 350, xp: 700 }, EXPERT: { coins: 700, xp: 1500 } };
    const r = rewards[difficulty] || rewards.EASY;
    const challenge = await prisma.challenge.create({
      data: { title, description, difficulty, category, coinReward: r.coins, xpReward: r.xp, createdBy: decoded.userId }
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
    const newXp = user.xp + challenge.xpReward;
    const newLevel = Math.floor(newXp / 1000) + 1;
    const updatedUser = await prisma.user.update({
      where: { id: decoded.userId },
      data: { coins: { increment: challenge.coinReward }, xp: newXp, level: newLevel }
    });
    res.json({ message: "Défi complété !", coinsEarned: challenge.coinReward, xpEarned: challenge.xpReward, user: updatedUser });
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
    const challenges = await prisma.userChallenge.findMany({
      where: { userId: decoded.userId },
      include: { challenge: true },
      orderBy: { startedAt: 'desc' }
    });
    res.json(challenges);
  } catch (error) {
    res.status(401).json({ error: 'Token invalide' });
  }
});

// ─── IA GÉNÉRATION DE DÉFIS ──────────────────────────────────────────────────

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const AI_SYSTEM_PROMPT = `Tu es un assistant de création de défis personnalisés pour une application de gamification. Aide l'utilisateur à créer des défis motivants et adaptés à ses objectifs.

PROCESSUS:
1. L'utilisateur décrit son objectif
2. Tu peux poser des questions de suivi (maximum 3 au total, une à la fois) pour mieux cerner ses besoins
3. Quand tu as assez d'informations, génère exactement 5 défis personnalisés

RÈGLES:
- Questions courtes et précises, une seule à la fois
- Après 2-3 questions maximum, génère les défis
- Si l'objectif est clair d'emblée, génère directement les défis sans poser de questions
- Les défis doivent être concrets, actionnables et progressifs

CATÉGORIES disponibles: GAMING, SPORT, CUISINE, FITNESS, CREATIVITY, KNOWLEDGE, SOCIAL
DIFFICULTÉS disponibles: EASY, MEDIUM, HARD, EXPERT

RÉPONDS UNIQUEMENT en JSON valide, rien d'autre:
Pour une question: {"type":"question","content":"Ta question ici"}
Pour les défis: {"type":"challenges","challenges":[{"title":"...","description":"...","category":"...","difficulty":"..."}]}

Génère exactement 5 défis variés (idéalement 2 EASY, 2 MEDIUM, 1 HARD ou EXPERT).
Titres: max 80 caractères. Descriptions: max 500 caractères, claires et actionnables.`;

app.post('/api/challenges/ai-generate', async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'Token manquant' });
  const { history } = req.body;
  if (!history || !Array.isArray(history) || history.length === 0) {
    return res.status(400).json({ error: 'Historique de conversation requis' });
  }
  try {
    jwt.verify(authHeader.split(' ')[1], SECRET);
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      system: AI_SYSTEM_PROMPT,
      messages: history,
    });
    const text = response.content[0].text.trim();
    try {
      const parsed = JSON.parse(text);
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
      challenges.map(({ title, description, difficulty, category }) => {
        const r = rewards[difficulty] || rewards.EASY;
        return prisma.challenge.create({
          data: { title, description, difficulty, category, coinReward: r.coins, xpReward: r.xp, createdBy: decoded.userId }
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

app.get('/api/leaderboard', async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true, username: true, avatar: true, coins: true, xp: true, level: true,
        _count: { select: { challenges: true } },
        cosmetics: {
          where: { equipped: true },
          select: { cosmeticId: true, equipped: true, cosmetic: { select: { id: true, name: true, type: true, rarity: true, imageUrl: true } } }
        }
      },
      orderBy: { xp: 'desc' },
      take: 50
    });
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: "Erreur lors de la récupération du classement" });
  }
});