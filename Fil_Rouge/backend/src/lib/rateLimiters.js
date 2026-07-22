import rateLimit from 'express-rate-limit';

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
