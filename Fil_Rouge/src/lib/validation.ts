// Simple vérification de forme (pas de validation RFC complète — c'est juste un garde-fou
// client, le serveur reste la source de vérité). Écrite avec des méthodes de chaîne plutôt
// qu'une regex : une ancienne version utilisait /^[^\s@]+@[^\s@]+\.[^\s@]+$/, dont les classes
// de caractères se chevauchent (`[^\s@]` autorise aussi le point), ce qui la rendait
// vulnérable au backtracking catastrophique sur une entrée conçue pour ça.
export function validateEmail(email: string): boolean {
  if (/\s/.test(email)) return false;
  const at = email.indexOf('@');
  if (at <= 0 || at !== email.lastIndexOf('@')) return false;
  const local = email.slice(0, at);
  const domain = email.slice(at + 1);
  const dot = domain.indexOf('.');
  return local.length > 0 && dot > 0 && dot < domain.length - 1;
}
