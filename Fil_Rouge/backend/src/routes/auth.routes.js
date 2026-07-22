import { Router } from 'express';
import crypto from 'crypto';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma.js';
import { mailer } from '../lib/mailer.js';
import { SECRET } from '../lib/auth.js';
import { sanitizeUser } from '../lib/userUtils.js';
import { isStrongPassword, PASSWORD_REQUIREMENTS_TEXT } from '../lib/password.js';
import { hashToken } from '../lib/tokens.js';
import { FRONTEND_URL, DEFAULT_AVATAR } from '../lib/config.js';
import { loginLimiter, registerLimiter, forgotPasswordLimiter } from '../lib/rateLimiters.js';

const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1h

// Hash bcrypt fixe utilisé comme comparaison factice en login quand l'email n'existe pas
// (voir /api/auth/login) — pas de mot de passe réel associé, juste un hash valide à comparer.
const DUMMY_PASSWORD_HASH = bcrypt.hashSync(crypto.randomBytes(32).toString('hex'), 10);

const router = Router();

router.post('/api/auth/register', registerLimiter, async (req, res) => {
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

router.post('/api/auth/login', loginLimiter, async (req, res) => {
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
router.post('/api/auth/forgot-password', forgotPasswordLimiter, async (req, res) => {
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

router.post('/api/auth/reset-password', async (req, res) => {
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

export default router;
