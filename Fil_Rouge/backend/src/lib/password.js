// Règle de mot de passe fort, identique côté frontend (src/lib/passwordPolicy.ts) :
// 8 caractères minimum, une majuscule, une minuscule, un chiffre, un caractère spécial.
const STRONG_PASSWORD_RE = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;
export const PASSWORD_REQUIREMENTS_TEXT = '8 caractères minimum, avec au moins une majuscule, une minuscule, un chiffre et un caractère spécial.';
export const isStrongPassword = (password) => STRONG_PASSWORD_RE.test(password);
