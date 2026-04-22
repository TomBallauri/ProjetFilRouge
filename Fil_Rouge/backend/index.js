import express from 'express';
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import multer from 'multer';
import path from 'path';
import jwt from 'jsonwebtoken';
import cors from 'cors';

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
    res.json({ message: 'Utilisateur créé', user });
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
        user: true,
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
      include: { user: true },
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