// Règle de mot de passe fort, appliquée à l'identique côté serveur (backend/index.js).
// Au moins 8 caractères, une majuscule, une minuscule, un chiffre et un caractère spécial.
export const PASSWORD_REQUIREMENTS_TEXT =
  '8 caractères minimum, avec au moins une majuscule, une minuscule, un chiffre et un caractère spécial.';

const STRONG_PASSWORD_RE = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;

export function isStrongPassword(password: string): boolean {
  return STRONG_PASSWORD_RE.test(password);
}
