import rateLimit, { ipKeyGenerator } from 'express-rate-limit';

// Anti brute-force / spam sur les routes d'auth : login (credential stuffing), register
// (création de comptes en masse) et forgot-password (chaque appel envoie un vrai email).
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Trop de tentatives de connexion. Réessaie dans quelques minutes.' },
});
export const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Trop de comptes créés depuis cette adresse. Réessaie plus tard.' },
});
export const forgotPasswordLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Trop de demandes de réinitialisation. Réessaie plus tard.' },
});
export const emailChangeLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Trop de demandes de changement d\'email. Réessaie plus tard.' },
});

// Par utilisateur (pas par IP) : ces deux routes sont authentifiées, donc req.userId est
// disponible (le middleware d'auth doit tourner avant) — plus juste qu'une limite par IP,
// qui bloquerait tout un réseau partagé ou qu'un attaquant contournerait en changeant d'IP.
const perUserLimiter = ({ windowMs, limit, message }) => rateLimit({
  windowMs,
  limit,
  standardHeaders: true,
  legacyHeaders: false,
  // ipKeyGenerator (au lieu de req.ip nu) normalise les IPv6 : sinon une même adresse
  // représentée différemment permettrait de contourner la limite pour le repli anonyme.
  keyGenerator: (req) => req.userId?.toString() ?? ipKeyGenerator(req.ip),
  message: { error: message },
});

// Chaque appel coûte un vrai appel API Groq facturé à l'usage : sans limite, un seul compte
// compromis ou un utilisateur mal intentionné peut générer des coûts et épuiser le quota
// partagé de la clé API pour tout le monde.
export const aiGenerateLimiter = perUserLimiter({
  windowMs: 60 * 60 * 1000,
  limit: 20,
  message: 'Trop de générations IA. Réessaie dans un peu moins d\'une heure.',
});

// Chaque upload va en base (BYTEA) : sans limite, un compte peut gonfler le stockage en
// boucle jusqu'à 5 Mo par appel sans aucun frein.
export const uploadLimiter = perUserLimiter({
  windowMs: 60 * 60 * 1000,
  limit: 30,
  message: 'Trop de fichiers envoyés. Réessaie plus tard.',
});
