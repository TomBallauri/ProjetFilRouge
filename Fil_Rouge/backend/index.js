import express from 'express';
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import multer from 'multer';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import cors from 'cors';
import Groq from 'groq-sdk';
import nodemailer from 'nodemailer';
import rateLimit from 'express-rate-limit';
import { StreakService } from './services/StreakService.js';
import { RewardCalculator, GroupBonus, LevelProgression } from './services/RewardCalculator.js';

const app = express();
const prisma = new PrismaClient();
const streakService = new StreakService(prisma);

app.use(cors());
app.use(express.json());
// express.json() laisse req.body à `undefined` (au lieu de `{}`) quand la requête
// n'a pas de Content-Type application/json — ce qui fait planter (500) toute route
// qui déstructure req.body directement, avant même sa validation métier.
app.use((req, res, next) => {
  if (req.body === undefined) req.body = {};
  next();
});
// Pas de valeur par défaut : un secret connu publiquement (ex-'supersecret') permettrait
// de forger n'importe quel token (y compris admin) si la variable d'env est mal configurée.
const SECRET = process.env.JWT_SECRET;
if (!SECRET) {
  throw new Error('JWT_SECRET est manquant. Défini-le dans les variables d\'environnement avant de démarrer le serveur.');
}
const DEFAULT_AVATAR = '/default-avatar.svg';
// Ne jamais renvoyer le hash du mot de passe au client, même pour son propre compte.
const sanitizeUser = (user) => {
  const { password, ...safe } = user;
  return { ...safe, avatar: safe.avatar || DEFAULT_AVATAR };
};
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';
const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1h
const EMAIL_CHANGE_TOKEN_TTL_MS = 60 * 60 * 1000; // 1h
const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');
// Hash bcrypt fixe utilisé comme comparaison factice en login quand l'email n'existe pas
// (voir /api/auth/login) — pas de mot de passe réel associé, juste un hash valide à comparer.
const DUMMY_PASSWORD_HASH = bcrypt.hashSync(crypto.randomBytes(32).toString('hex'), 10);

// Anti brute-force / spam sur les routes d'auth : login (credential stuffing), register
// (création de comptes en masse) et forgot-password (chaque appel envoie un vrai email).
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Trop de tentatives de connexion. Réessaie dans quelques minutes.' },
});
const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Trop de comptes créés depuis cette adresse. Réessaie plus tard.' },
});
const forgotPasswordLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Trop de demandes de réinitialisation. Réessaie plus tard.' },
});
const emailChangeLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Trop de demandes de changement d\'email. Réessaie plus tard.' },
});

// Règle de mot de passe fort, identique côté frontend (src/lib/passwordPolicy.ts) :
// 8 caractères minimum, une majuscule, une minuscule, un chiffre, un caractère spécial.
const STRONG_PASSWORD_RE = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;
const PASSWORD_REQUIREMENTS_TEXT = '8 caractères minimum, avec au moins une majuscule, une minuscule, un chiffre et un caractère spécial.';
const isStrongPassword = (password) => STRONG_PASSWORD_RE.test(password);

const mailer = nodemailer.createTransport({
  service: 'gmail',
  auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD },
});

// Alias conservé le temps de la migration : toute la logique de streak vit
// désormais dans services/StreakService.js (voir docs/architecture-reutilisable.md).
async function updateStreak(userId) {
  return streakService.updateForUser(userId);
}

app.post('/api/auth/register', registerLimiter, async (req, res) => {
  const { username, email, password, avatar } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email et mot de passe requis.' });
  if (!isStrongPassword(password)) return res.status(400).json({ error: `Mot de passe trop faible : ${PASSWORD_REQUIREMENTS_TEXT}` });
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
    res.json({ message: 'Utilisateur créé', token, user: sanitizeUser(user) });
  } catch (error) {
    res.status(400).json({ error: 'Utilisateur ou email déjà pris.' });
  }
});

app.post('/api/auth/login', loginLimiter, async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email et mot de passe requis.' });
  const user = await prisma.user.findUnique({ where: { email } });
  // bcrypt.compare tourne même si l'email est inconnu (contre un hash factice) : sinon le
  // temps de réponse trahit quels emails sont enregistrés (oracle de timing).
  const valid = await bcrypt.compare(password, user?.password ?? DUMMY_PASSWORD_HASH);
  if (!user || !valid) {
    return res.status(401).json({ error: 'Email ou mot de passe incorrect' });
  }
  const token = jwt.sign({ userId: user.id }, SECRET, { expiresIn: '1d' });
  res.json({ token, user: sanitizeUser(user) });
});

// Ne révèle jamais si l'email existe ou non (évite l'énumération de comptes) —
// la réponse est identique que l'email soit connu ou pas.
app.post('/api/auth/forgot-password', forgotPasswordLimiter, async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email requis.' });
  const genericMessage = { message: 'Si un compte existe avec cet email, un lien de réinitialisation vient de lui être envoyé.' };
  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.json(genericMessage);

    const rawToken = crypto.randomBytes(32).toString('hex');
    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(rawToken),
        expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS),
      },
    });

    const resetUrl = `${FRONTEND_URL}/reset-password?token=${rawToken}`;
    await mailer.sendMail({
      from: `"U-Quail" <${process.env.GMAIL_USER}>`,
      to: email,
      subject: 'Réinitialise ton mot de passe U-Quail',
      html: `<p>Tu as demandé à réinitialiser ton mot de passe.</p>
             <p><a href="${resetUrl}">Clique ici pour choisir un nouveau mot de passe</a> (valable 1 heure).</p>
             <p>Si tu n'es pas à l'origine de cette demande, ignore simplement cet email.</p>`,
    });
    res.json(genericMessage);
  } catch (error) {
    console.error('[forgot-password]', error);
    res.json(genericMessage);
  }
});

app.post('/api/auth/reset-password', async (req, res) => {
  const { token, password } = req.body;
  if (!token || !password) return res.status(400).json({ error: 'Token et nouveau mot de passe requis.' });
  if (!isStrongPassword(password)) return res.status(400).json({ error: `Mot de passe trop faible : ${PASSWORD_REQUIREMENTS_TEXT}` });
  try {
    const tokenHash = hashToken(token);
    const record = await prisma.passwordResetToken.findUnique({ where: { tokenHash } });
    if (!record || record.expiresAt < new Date()) {
      return res.status(400).json({ error: 'Lien invalide ou expiré.' });
    }
    const hashed = await bcrypt.hash(password, 10);
    await prisma.$transaction([
      prisma.user.update({ where: { id: record.userId }, data: { password: hashed } }),
      prisma.passwordResetToken.deleteMany({ where: { userId: record.userId } }),
    ]);
    res.json({ message: 'Mot de passe mis à jour. Tu peux te connecter.' });
  } catch (error) {
    console.error('[reset-password]', error);
    res.status(500).json({ error: 'Erreur lors de la réinitialisation.' });
  }
});

app.get('/api/users', isAdmin, async (req, res) => {
  const users = await prisma.user.findMany({
    select: {
      id: true, username: true, email: true, isAdmin: true,
      coins: true, xp: true, level: true, currentStreak: true, createdAt: true,
    },
    orderBy: { id: 'asc' },
  });
  res.json(users);
});

app.get('/api/users/me', async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ user: null });
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, SECRET);
    const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
    if (!user) return res.status(404).json({ user: null });
    res.json({ user: sanitizeUser(user) });
  } catch (err) {
    return res.status(401).json({ user: null });
  }
});

// L'email ne se change plus ici : voir /api/users/me/email/request-change +
// /api/auth/confirm-email-change, qui exigent une preuve de possession de la nouvelle adresse.
app.put('/api/users/me', async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'Token manquant' });
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, SECRET);
    const userId = decoded.userId;
    const { username, bio, avatar, banner } = req.body;
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { username, bio, avatar, banner }
    });
    res.json({ user: sanitizeUser(updatedUser) });
  } catch (err) {
    return res.status(401).json({ error: 'Token invalide' });
  }
});

// Préférences UI (mode sombre, notifications, langue...) liées au compte plutôt qu'au
// navigateur, pour qu'elles suivent l'utilisateur d'un appareil à l'autre.
const ALLOWED_SETTINGS_KEYS = ['darkMode', 'notifDefis', 'notifMessages', 'notifUpdates', 'reduceMotion', 'language'];
app.put('/api/users/me/settings', authMiddleware, async (req, res) => {
  try {
    const patch = {};
    for (const key of ALLOWED_SETTINGS_KEYS) {
      if (key in req.body) patch[key] = req.body[key];
    }
    const current = await prisma.user.findUnique({ where: { id: req.userId }, select: { settings: true } });
    const merged = { ...(current?.settings ?? {}), ...patch };
    const updated = await prisma.user.update({
      where: { id: req.userId },
      data: { settings: merged },
      select: { settings: true },
    });
    res.json({ settings: updated.settings });
  } catch (err) {
    console.error('[users/me/settings]', err);
    res.status(400).json({ error: 'Erreur lors de la sauvegarde des préférences.' });
  }
});

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Étape 1 : demander le changement — envoie un lien de confirmation à la NOUVELLE adresse.
// L'email du compte n'est pas modifié tant que le lien n'a pas été cliqué.
app.post('/api/users/me/email/request-change', emailChangeLimiter, async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'Token manquant' });
  try {
    const decoded = jwt.verify(authHeader.split(' ')[1], SECRET);
    const { newEmail } = req.body;
    if (!newEmail || !EMAIL_RE.test(newEmail)) {
      return res.status(400).json({ error: 'Adresse email invalide.' });
    }
    const existing = await prisma.user.findUnique({ where: { email: newEmail } });
    if (existing) return res.status(400).json({ error: 'Cette adresse email est déjà utilisée.' });

    const rawToken = crypto.randomBytes(32).toString('hex');
    await prisma.emailChangeToken.create({
      data: {
        userId: decoded.userId,
        newEmail,
        tokenHash: hashToken(rawToken),
        expiresAt: new Date(Date.now() + EMAIL_CHANGE_TOKEN_TTL_MS),
      },
    });
    const confirmUrl = `${FRONTEND_URL}/confirm-email-change?token=${rawToken}`;
    await mailer.sendMail({
      from: `"U-Quail" <${process.env.GMAIL_USER}>`,
      to: newEmail,
      subject: 'Confirme ta nouvelle adresse email U-Quail',
      html: `<p>Tu as demandé à changer l'adresse email de ton compte U-Quail pour celle-ci.</p>
             <p><a href="${confirmUrl}">Clique ici pour confirmer ce changement</a> (valable 1 heure).</p>
             <p>Si tu n'es pas à l'origine de cette demande, ignore simplement cet email.</p>`,
    });
    res.json({ message: 'Un email de confirmation a été envoyé à la nouvelle adresse.' });
  } catch (err) {
    if (err instanceof jwt.JsonWebTokenError) return res.status(401).json({ error: 'Token invalide' });
    console.error('[email/request-change]', err);
    res.status(500).json({ error: "Erreur lors de la demande de changement d'email." });
  }
});

// Étape 2 : confirmation via le lien reçu par email — applique enfin le changement.
app.post('/api/auth/confirm-email-change', async (req, res) => {
  const { token } = req.body;
  if (!token) return res.status(400).json({ error: 'Token requis.' });
  try {
    const tokenHash = hashToken(token);
    const record = await prisma.emailChangeToken.findUnique({ where: { tokenHash } });
    if (!record || record.expiresAt < new Date()) {
      return res.status(400).json({ error: 'Lien invalide ou expiré.' });
    }
    const existing = await prisma.user.findUnique({ where: { email: record.newEmail } });
    if (existing) {
      await prisma.emailChangeToken.deleteMany({ where: { userId: record.userId } });
      return res.status(400).json({ error: 'Cette adresse email est déjà utilisée.' });
    }
    const [updatedUser] = await prisma.$transaction([
      prisma.user.update({ where: { id: record.userId }, data: { email: record.newEmail } }),
      prisma.emailChangeToken.deleteMany({ where: { userId: record.userId } }),
    ]);
    res.json({ message: 'Adresse email mise à jour.', user: sanitizeUser(updatedUser) });
  } catch (error) {
    console.error('[confirm-email-change]', error);
    res.status(500).json({ error: 'Erreur lors de la confirmation.' });
  }
});

app.put('/api/users/:id', isAdmin, async (req, res) => {
  const targetId = Number(req.params.id);
  const { username, email, bio, avatar, banner, isAdmin: makeAdmin, coins, xp, level, currentStreak } = req.body;
  if (targetId === req.user.id && makeAdmin === false) {
    return res.status(400).json({ error: 'Tu ne peux pas retirer ton propre rôle admin.' });
  }
  try {
    const updatedUser = await prisma.user.update({
      where: { id: targetId },
      data: { username, email, bio, avatar, banner, isAdmin: makeAdmin, coins, xp, level, currentStreak }
    });
    res.json({ user: sanitizeUser(updatedUser) });
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
    if (!isStrongPassword(newPassword)) return res.status(400).json({ error: `Mot de passe trop faible : ${PASSWORD_REQUIREMENTS_TEXT}` });
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

// Authentification requise : sans ça, un scan d'ids permettrait à n'importe qui de lister
// tous les comptes (même en ne renvoyant que des champs non sensibles).
app.get('/api/users/:id', authMiddleware, async (req, res) => {
  const { id } = req.params;
  try {
    const user = await prisma.user.findUnique({
      where: { id: Number(id) || id },
      select: {
        id: true, username: true, avatar: true, banner: true, bio: true,
        xp: true, level: true, currentStreak: true, createdAt: true,
      }
    });
    if (!user) return res.status(404).json({ error: "Utilisateur non trouvé" });
    res.json({ user });
  } catch (err) {
    res.status(400).json({ error: "Erreur lors de la récupération de l'utilisateur" });
  }
});

// Stockage en mémoire (pas sur disque) : le disque de Render est éphémère et
// perd son contenu à chaque redémarrage/redéploiement. Les fichiers sont
// persistés dans PostgreSQL (modèle UploadedFile) plutôt que sur le filesystem.
// Whitelist stricte de types raster : un SVG accepté ("image/*") peut embarquer du <script>
// et l'exécuter si son URL /uploads/:id est ouverte directement (hors <img>) — XSS stocké.
const ALLOWED_UPLOAD_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_UPLOAD_TYPES.has(file.mimetype)) return cb(new Error('Format non supporté. JPEG, PNG ou WebP uniquement.'));
    cb(null, true);
  },
});

app.post('/api/upload', authMiddleware, (req, res) => {
  upload.single('file')(req, res, async (err) => {
    if (err) return res.status(400).json({ error: err.message || 'Erreur upload' });
    if (!req.file) return res.status(400).json({ error: 'Aucun fichier' });
    try {
      const id = crypto.randomBytes(16).toString('hex');
      await prisma.uploadedFile.create({
        data: { id, mimeType: req.file.mimetype, data: req.file.buffer },
      });
      res.json({ url: `/uploads/${id}` });
    } catch {
      res.status(500).json({ error: "Erreur lors de l'enregistrement du fichier" });
    }
  });
});

app.get('/uploads/:filename', async (req, res) => {
  const file = await prisma.uploadedFile.findUnique({ where: { id: req.params.filename } });
  if (!file) return res.status(404).json({ error: 'Fichier non trouvé' });
  res.set('Content-Type', file.mimeType);
  res.set('Cache-Control', 'public, max-age=31536000, immutable');
  res.send(Buffer.from(file.data));
});

const port = process.env.PORT || 3001;
app.listen(port, () => {
  console.log(`Serveur backend lancé sur http://localhost:${port}`);
  // Create performance indexes in background (idempotent — safe to run on every boot)
  Promise.all([
    prisma.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "Challenge_seriesName_idx" ON "Challenge"("seriesName")'),
    prisma.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "UserChallenge_userId_status_idx" ON "UserChallenge"("userId", "status")'),
    prisma.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "SeriesGroupMember_userId_idx" ON "SeriesGroupMember"("userId")'),
    prisma.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "SeriesGroupMember_groupId_idx" ON "SeriesGroupMember"("groupId")'),
    prisma.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "SeriesGroupMessage_groupId_createdAt_idx" ON "SeriesGroupMessage"("groupId", "createdAt")'),
  ]).catch(() => {});
});

app.delete('/api/users/:id', isAdmin, async (req, res) => {
  if (Number(req.params.id) === req.user.id) {
    return res.status(400).json({ error: 'Tu ne peux pas supprimer ton propre compte.' });
  }
  try {
    await prisma.user.delete({ where: { id: Number(req.params.id) } });
    res.json({ message: "Utilisateur supprimé" });
  } catch (error) {
    res.status(400).json({ error: "Erreur lors de la suppression de l'utilisateur" });
  }
});

async function isAdmin(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'Token manquant' });
  try {
    const decoded = jwt.verify(authHeader.split(' ')[1], SECRET);
    const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
    if (!user || !user.isAdmin) return res.status(403).json({ error: 'Accès refusé' });
    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Token invalide' });
  }
}

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
    const all = await prisma.challenge.findMany({
      where,
      include: {
        creator: { select: { id: true, username: true, avatar: true } },
        _count: { select: { participants: true } }
      },
      orderBy: { createdAt: 'desc' },
    });

    // Une série (défis liés par seriesName) compte comme UN seul objet pour la pagination,
    // au même titre qu'un défi solo — sinon "Charger plus" ne renvoie parfois que des jours
    // d'une série déjà entièrement affichée en une seule carte côté frontend, et le bouton
    // semble ne rien faire.
    const groupKeys = [];
    const groupMap = new Map();
    for (const c of all) {
      const key = c.seriesName ?? `solo-${c.id}`;
      if (!groupMap.has(key)) { groupMap.set(key, []); groupKeys.push(key); }
      groupMap.get(key).push(c);
    }

    const total = groupKeys.length;
    const pageKeys = groupKeys.slice(skip, skip + limit);
    const challenges = pageKeys.flatMap(key => groupMap.get(key));

    res.json({ challenges, total, hasMore: skip + pageKeys.length < total });
  } catch (error) {
    res.status(500).json({ error: "Erreur lors de la récupération des défis" });
  }
});

// Tous les défis d'une série en un seul appel (non paginé) — utilisé par le frontend pour afficher
// une série de façon cohérente sans dépendre de la pagination des listes "en cours"/"terminés".
app.get('/api/challenges/by-series/:seriesName', async (req, res) => {
  try {
    const seriesName = decodeURIComponent(req.params.seriesName);
    const authHeader = req.headers.authorization;
    let currentUserId = null;
    if (authHeader) {
      try { currentUserId = jwt.verify(authHeader.split(' ')[1], SECRET).userId; } catch {}
    }
    const visibilityClause = currentUserId
      ? { OR: [{ isPublic: true }, { createdBy: currentUserId }] }
      : { isPublic: true };
    const challenges = await prisma.challenge.findMany({
      where: { seriesName, ...visibilityClause },
      include: {
        creator: { select: { id: true, username: true, avatar: true } },
        _count: { select: { participants: true } }
      }
    });
    res.json(challenges);
  } catch (error) {
    res.status(500).json({ error: 'Erreur' });
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

// ─── ADMIN : gestion complète des défis ──────────────────────────────────────

app.get('/api/admin/challenges', isAdmin, async (req, res) => {
  try {
    const challenges = await prisma.challenge.findMany({
      include: {
        creator: { select: { id: true, username: true } },
        _count: { select: { participants: true } },
      },
      orderBy: { id: 'desc' },
    });
    res.json(challenges);
  } catch (error) {
    res.status(500).json({ error: "Erreur lors de la récupération des défis" });
  }
});

app.post('/api/admin/challenges', isAdmin, async (req, res) => {
  const { title, description, difficulty, category, coinReward, xpReward, isPublic, isDefault, seriesName } = req.body;
  if (!title || !description || !difficulty || !category) {
    return res.status(400).json({ error: "Champs requis manquants" });
  }
  try {
    const created = await prisma.challenge.create({
      data: {
        title, description, difficulty, category,
        coinReward: coinReward ?? 50, xpReward: xpReward ?? 100,
        isPublic: isPublic !== false, isDefault: !!isDefault,
        seriesName: seriesName || null,
        createdBy: req.user.id,
      },
    });
    res.json(created);
  } catch (error) {
    res.status(400).json({ error: "Impossible de créer le défi" });
  }
});

app.put('/api/admin/challenges/:id', isAdmin, async (req, res) => {
  const { title, description, difficulty, category, coinReward, xpReward, isPublic, isDefault, seriesName } = req.body;
  try {
    const updated = await prisma.challenge.update({
      where: { id: Number(req.params.id) },
      data: {
        title, description, difficulty, category, coinReward, xpReward,
        isPublic, isDefault, seriesName: seriesName || null,
      },
    });
    res.json(updated);
  } catch (error) {
    res.status(400).json({ error: "Impossible de mettre à jour le défi" });
  }
});

app.delete('/api/admin/challenges/:id', isAdmin, async (req, res) => {
  try {
    await prisma.challenge.delete({ where: { id: Number(req.params.id) } });
    res.json({ message: 'Défi supprimé' });
  } catch (error) {
    res.status(400).json({ error: "Impossible de supprimer ce défi (probablement encore lié à des participants)" });
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
    try { streakResult = await streakService.updateForUser(decoded.userId); } catch {}
    const freshUser = streakResult?.user ?? user;
    const streakMultiplier = StreakService.multiplierFor(freshUser?.currentStreak ?? 0);
    const dailyChallenge = await getDailyChallenge();
    const isDailyBonus = dailyChallenge?.id === challengeId;
    const dailyMultiplier = isDailyBonus ? DAILY_BONUS_MULTIPLIER : 1;

    // Bonus de groupe : +10% de récompenses par membre supplémentaire ayant
    // rejoint le groupe du défi (2 joueurs = x1.1, 3 = x1.2, 4 = x1.3...).
    // Couvre les deux types de groupe : défi unique (ChallengeGroup) et série (SeriesGroup).
    let groupSize = 1;
    const challengeGroup = await prisma.challengeGroup.findFirst({
      where: { challengeId, members: { some: { userId: decoded.userId, status: { in: ['JOINED', 'COMPLETED'] } } } },
      include: { members: true },
    });
    if (challengeGroup) {
      groupSize = challengeGroup.members.filter(m => m.status === 'JOINED' || m.status === 'COMPLETED').length;
    } else if (challenge.seriesName && seriesGroupReady()) {
      const seriesGroup = await prisma.seriesGroup.findFirst({
        where: { seriesName: challenge.seriesName, members: { some: { userId: decoded.userId, status: 'JOINED' } } },
        include: { members: true },
      });
      if (seriesGroup) {
        groupSize = seriesGroup.members.filter(m => m.status === 'JOINED').length;
      }
    }
    const groupBonus = new GroupBonus(groupSize);
    const reward = new RewardCalculator({
      streakMultiplier,
      dailyMultiplier,
      groupMultiplier: groupBonus.multiplier,
    });

    const coinsEarned = reward.coinsFor(challenge.coinReward);
    const xpEarned = reward.xpFor(challenge.xpReward);
    const newXp = freshUser.xp + xpEarned;
    const newLevel = LevelProgression.levelForXp(newXp);
    const updatedUser = await prisma.user.update({
      where: { id: decoded.userId },
      data: { coins: { increment: coinsEarned }, xp: newXp, level: newLevel }
    });
    res.json({
      message: "Défi complété !",
      coinsEarned, xpEarned, multiplier: streakMultiplier,
      isDailyBonus, dailyMultiplier,
      groupSize, groupBonusMultiplier: groupBonus.multiplier,
      streak: { current: freshUser.currentStreak, milestone: streakResult?.milestone ?? null },
      user: sanitizeUser(updatedUser)
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

    const [all, totalCompleted, totalInProgress] = await Promise.all([
      prisma.userChallenge.findMany({
        where,
        include: { challenge: true },
        orderBy: { startedAt: 'desc' },
      }),
      prisma.userChallenge.count({ where: { userId: decoded.userId, status: 'COMPLETED' } }),
      prisma.userChallenge.count({ where: { userId: decoded.userId, status: 'IN_PROGRESS' } }),
    ]);

    // Une série compte comme UN seul objet pour la pagination, comme un défi solo — même
    // correctif que sur GET /api/challenges, pour que "Charger plus" ramène toujours des
    // groupes réellement nouveaux au lieu de jours d'une série déjà entièrement affichée.
    const groupKeys = [];
    const groupMap = new Map();
    for (const uc of all) {
      const key = uc.challenge.seriesName ?? `solo-${uc.challengeId}`;
      if (!groupMap.has(key)) { groupMap.set(key, []); groupKeys.push(key); }
      groupMap.get(key).push(uc);
    }
    const total = groupKeys.length;
    const pageKeys = groupKeys.slice(skip, skip + limit);
    const challenges = pageKeys.flatMap(key => groupMap.get(key));

    res.json({ challenges, total, totalCompleted, totalInProgress, hasMore: skip + pageKeys.length < total });
  } catch (error) {
    res.status(401).json({ error: 'Token invalide' });
  }
});

// Dashboard: toutes les données utilisateur en un seul appel
app.get('/api/users/me/dashboard', authMiddleware, async (req, res) => {
  const userId = req.userId;
  try {
    await expireStaleInvites();
    const [inProgressAll, completedAll, allStatuses, groups, pendingSeriesInvites] = await Promise.all([
      prisma.userChallenge.findMany({
        where: { userId, status: 'IN_PROGRESS' },
        include: { challenge: true },
        orderBy: { startedAt: 'desc' },
      }),
      prisma.userChallenge.findMany({
        where: { userId, status: 'COMPLETED' },
        include: { challenge: true },
        orderBy: { startedAt: 'desc' },
      }),
      prisma.userChallenge.findMany({
        where: { userId },
        select: { challengeId: true, status: true },
      }),
      prisma.challengeGroup.findMany({
        where: { members: { some: { userId } } },
        include: GROUP_LIST_INCLUDE,
        orderBy: { createdAt: 'desc' },
      }),
      seriesGroupReady() ? prisma.seriesGroup.findMany({
        where: { members: { some: { userId, status: 'INVITED' } } },
        include: {
          creator: { select: { id: true, username: true, avatar: true } },
          members: { include: { user: { select: { id: true, username: true, avatar: true } } } },
        },
      }) : Promise.resolve([]),
    ]);

    // Une série compte comme UN seul objet pour la pagination, comme un défi solo — même
    // correctif que sur GET /api/challenges et /api/users/me/challenges, pour que la
    // première page (chargée ici au montage) et "Charger plus" restent cohérents.
    const firstPage = (all, limit) => {
      const groupKeys = [];
      const groupMap = new Map();
      for (const uc of all) {
        const key = uc.challenge.seriesName ?? `solo-${uc.challengeId}`;
        if (!groupMap.has(key)) { groupMap.set(key, []); groupKeys.push(key); }
        groupMap.get(key).push(uc);
      }
      const total = groupKeys.length;
      const pageKeys = groupKeys.slice(0, limit);
      return { challenges: pageKeys.flatMap(key => groupMap.get(key)), total, hasMore: pageKeys.length < total };
    };

    res.json({
      challenges: allStatuses,
      inProgress: firstPage(inProgressAll, 10),
      completed:  firstPage(completedAll, 10),
      groups,
      pendingSeriesInvites,
    });
  } catch (error) {
    res.status(500).json({ error: 'Erreur' });
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
  const { challenges, seriesName } = req.body;
  if (!challenges || !Array.isArray(challenges) || challenges.length === 0) {
    return res.status(400).json({ error: 'Défis requis' });
  }
  try {
    const decoded = jwt.verify(token, SECRET);
    const rewards = { EASY: { coins: 50, xp: 100 }, MEDIUM: { coins: 150, xp: 300 }, HARD: { coins: 350, xp: 700 }, EXPERT: { coins: 700, xp: 1500 } };
    let resolvedSeries = seriesName && typeof seriesName === 'string' ? seriesName.trim().slice(0, 80) || null : null;

    // Le nom de série est dérivé du prompt utilisateur : deux prompts similaires ("Me mettre au sport")
    // tomberaient sinon sur le même nom et fusionneraient leur progression avec une série existante
    // sans rapport (même complétée par quelqu'un d'autre). On garantit donc un nom toujours neuf.
    if (resolvedSeries) {
      try {
        const base = resolvedSeries;
        for (let suffix = 2; await prisma.challenge.count({ where: { seriesName: resolvedSeries } }) > 0; suffix++) {
          resolvedSeries = `${base} (${suffix})`.slice(0, 80);
        }
      } catch {
        // Prisma client not yet regenerated — skip dedup, fall back to no series name
        resolvedSeries = null;
      }
    }

    const createOne = ({ title, description, difficulty, category, isPublic }, withSeries) => {
      const r = rewards[difficulty] || rewards.EASY;
      return prisma.challenge.create({
        data: {
          title, description, difficulty, category,
          coinReward: r.coins, xpReward: r.xp,
          createdBy: decoded.userId,
          isPublic: isPublic !== false,
          ...(withSeries && resolvedSeries ? { seriesName: resolvedSeries } : {}),
          participants: { create: { userId: decoded.userId, status: 'IN_PROGRESS' } },
        },
      });
    };
    let created;
    try {
      created = await Promise.all(challenges.map(c => createOne(c, true)));
    } catch {
      // Prisma client not yet regenerated — retry without seriesName
      created = await Promise.all(challenges.map(c => createOne(c, false)));
    }
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

// ─── ADMIN : gestion complète des cosmétiques ────────────────────────────────

app.post('/api/admin/cosmetics', isAdmin, async (req, res) => {
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

app.put('/api/admin/cosmetics/:id', isAdmin, async (req, res) => {
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

app.delete('/api/admin/cosmetics/:id', isAdmin, async (req, res) => {
  try {
    await prisma.cosmetic.delete({ where: { id: Number(req.params.id) } });
    res.json({ message: 'Cosmétique supprimé' });
  } catch (error) {
    res.status(400).json({ error: "Impossible de supprimer ce cosmétique" });
  }
});

app.post('/api/cosmetics/:id/buy', async (req, res) => {
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

// Profil page: challenges + cosmétiques en une seule requête
app.get('/api/users/me/profile-data', authMiddleware, async (req, res) => {
  const userId = req.userId;
  try {
    const [challenges, total, totalCompleted, totalInProgress, cosmetics] = await Promise.all([
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

app.get('/api/users/:id/profile', async (req, res) => {
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

// ─── GROUPES DE SÉRIE ─────────────────────────────────────────────────────────

// Guard : renvoie false si le client Prisma n'a pas encore été régénéré
const seriesGroupReady = () => !!prisma.seriesGroup;

// Les invitations de groupe (série ou défi) expirent 24h après leur envoi
const GROUP_INVITE_TTL_MS = 24 * 60 * 60 * 1000;
const isInviteExpired = (invitedAt) => Date.now() - new Date(invitedAt).getTime() > GROUP_INVITE_TTL_MS;

// Nettoyage paresseux : supprime les invitations INVITED devenues obsolètes avant de lire/écrire les groupes
async function expireStaleInvites() {
  const cutoff = new Date(Date.now() - GROUP_INVITE_TTL_MS);
  await Promise.all([
    seriesGroupReady()
      ? prisma.seriesGroupMember.deleteMany({ where: { status: 'INVITED', invitedAt: { lt: cutoff } } })
      : Promise.resolve(),
    prisma.challengeGroupMember.deleteMany({ where: { status: 'INVITED', invitedAt: { lt: cutoff } } }),
  ]);
}

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

// Démarrer tous les défis restants d'une série en une fois (sans passer par un groupe)
app.post('/api/challenges/series/:seriesName/start-all', authMiddleware, async (req, res) => {
  const seriesName = decodeURIComponent(req.params.seriesName);
  try {
    await ensureSeriesChallengesStarted(req.userId, seriesName);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Erreur lors du démarrage de la série' });
  }
});

// Créer un groupe de série
app.post('/api/series-groups', authMiddleware, async (req, res) => {
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
app.get('/api/series-groups/by-series/:seriesName', authMiddleware, async (req, res) => {
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
app.post('/api/series-groups/:id/join', authMiddleware, async (req, res) => {
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
app.post('/api/series-groups/:id/complete', authMiddleware, async (req, res) => {
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
app.delete('/api/series-groups/:id/leave', authMiddleware, async (req, res) => {
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
app.get('/api/series-groups/mine', authMiddleware, async (req, res) => {
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
app.post('/api/series-groups/:id/invite', authMiddleware, async (req, res) => {
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
app.delete('/api/series-groups/:id/members/:userId', authMiddleware, async (req, res) => {
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
app.get('/api/series-groups/pending-invites', authMiddleware, async (req, res) => {
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

const sgMsgReady = () => !!prisma.seriesGroupMessage;

// Récupérer les messages du tchat
// Détail d'un groupe + messages (pour la page de chat dédiée)
app.get('/api/series-groups/:id', authMiddleware, async (req, res) => {
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

app.get('/api/series-groups/:id/messages', authMiddleware, async (req, res) => {
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
app.post('/api/series-groups/:id/messages', authMiddleware, async (req, res) => {
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

// ─── NOTIFICATIONS ────────────────────────────────────────────────────────────

app.get('/api/notifications', authMiddleware, async (req, res) => {
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

// Pour le listing (pas de messages — chargés séparément à l'ouverture du chat)
const GROUP_LIST_INCLUDE = {
  challenge: { select: { id: true, title: true, description: true, difficulty: true, category: true, coinReward: true, xpReward: true } },
  creator: { select: { id: true, username: true, avatar: true } },
  members: {
    include: { user: { select: { id: true, username: true, avatar: true } } },
    orderBy: { invitedAt: 'asc' }
  },
};

const GROUP_INCLUDE = {
  ...GROUP_LIST_INCLUDE,
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