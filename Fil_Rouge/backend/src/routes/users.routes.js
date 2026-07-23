import { Router } from 'express';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma.js';
import { mailer } from '../lib/mailer.js';
import { SECRET, authMiddleware, isAdmin } from '../lib/auth.js';
import { sanitizeUser } from '../lib/userUtils.js';
import { isStrongPassword, PASSWORD_REQUIREMENTS_TEXT } from '../lib/password.js';
import { hashToken } from '../lib/tokens.js';
import { FRONTEND_URL } from '../lib/config.js';
import { emailChangeLimiter } from '../lib/rateLimiters.js';
import { StreakService } from '../../services/StreakService.js';

const EMAIL_CHANGE_TOKEN_TTL_MS = 60 * 60 * 1000; // 1h
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const router = Router();

router.get('/api/users', isAdmin, async (req, res) => {
  const users = await prisma.user.findMany({
    select: {
      id: true, username: true, email: true, isAdmin: true,
      coins: true, xp: true, level: true, currentStreak: true, lastStreakDate: true, createdAt: true,
    },
    orderBy: { id: 'asc' },
  });
  res.json(users.map((u) => {
    const { lastStreakDate, ...rest } = u;
    return { ...rest, currentStreak: StreakService.effectiveStreak(u) };
  }));
});

router.get('/api/users/me', async (req, res) => {
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
router.put('/api/users/me', async (req, res) => {
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
router.put('/api/users/me/settings', authMiddleware, async (req, res) => {
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

// Étape 1 : demander le changement — envoie un lien de confirmation à la NOUVELLE adresse.
// L'email du compte n'est pas modifié tant que le lien n'a pas été cliqué.
router.post('/api/users/me/email/request-change', emailChangeLimiter, async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'Token manquant' });
  // Ne jamais révéler si l'adresse est déjà prise (même logique que forgot-password) —
  // sinon n'importe qui peut sonder /request-change pour savoir si un email a un compte U-Quail.
  const genericMessage = { message: 'Si cette adresse est disponible, un email de confirmation vient de lui être envoyé.' };
  try {
    const decoded = jwt.verify(authHeader.split(' ')[1], SECRET);
    const { newEmail } = req.body;
    if (!newEmail || !EMAIL_RE.test(newEmail)) {
      return res.status(400).json({ error: 'Adresse email invalide.' });
    }
    const existing = await prisma.user.findUnique({ where: { email: newEmail } });
    if (existing) return res.json(genericMessage);

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
router.post('/api/auth/confirm-email-change', async (req, res) => {
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

router.put('/api/users/:id', isAdmin, async (req, res) => {
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

router.put('/api/users/me/password', async (req, res) => {
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
router.get('/api/users/search', authMiddleware, async (req, res) => {
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
router.get('/api/users/:id', authMiddleware, async (req, res) => {
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

router.delete('/api/users/:id', isAdmin, async (req, res) => {
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

export default router;
