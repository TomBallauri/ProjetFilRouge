// Limites de longueur pour les champs texte libres saisis par l'utilisateur — sans ça, rien
// n'empêchait d'envoyer une chaîne de plusieurs millions de caractères directement à l'API (en
// contournant les `maxLength` du frontend, qui ne protègent que l'UI), avec le risque que ça
// fasse planter l'appli en aval (écriture DB énorme, appel à l'API DeepL avec un texte géant lors
// de la traduction, rendu React d'un texte gigantesque côté client une fois relu).
// Valeurs alignées sur les `maxLength` déjà en place côté frontend (voir CreateChallenge.tsx,
// EditChallengeModal.tsx, ProfilePage.tsx) plutôt que d'inventer de nouveaux chiffres.
export const TITLE_MAX = 80;
export const DESCRIPTION_MAX = 500;
export const SERIES_NAME_MAX = 80;
export const CHAT_MESSAGE_MAX = 500;
export const BIO_MAX = 300;
export const USERNAME_MAX = 30;

// Renvoie un message d'erreur si `value` dépasse `max` caractères, sinon `null` — pensé pour
// `if (tooLong) return res.status(400).json({ error: tooLong })` sans dupliquer la condition
// à chaque route.
export function lengthError(value, max, fieldLabel) {
  if (typeof value === 'string' && value.length > max) {
    return `${fieldLabel} trop long (max ${max} caractères)`;
  }
  return null;
}
