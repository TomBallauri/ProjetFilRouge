import jwt from 'jsonwebtoken';
import { prisma } from './prisma.js';

// Pas de valeur par défaut : un secret connu publiquement (ex-'supersecret') permettrait
// de forger n'importe quel token (y compris admin) si la variable d'env est mal configurée.
export const SECRET = process.env.JWT_SECRET;
if (!SECRET) {
  throw new Error('JWT_SECRET est manquant. Défini-le dans les variables d\'environnement avant de démarrer le serveur.');
}

export function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'Token manquant' });
  try {
    req.userId = jwt.verify(authHeader.split(' ')[1], SECRET).userId;
    next();
  } catch { res.status(401).json({ error: 'Token invalide' }); }
}

export async function isAdmin(req, res, next) {
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
