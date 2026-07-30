// Déverrouillage progressif d'une série "Jour N" : le jour N ne devient complétable que N-1
// jours (fuseau UTC) après le début de la série POUR CET utilisateur — jour 1 dispo tout de
// suite, jour 2 le lendemain, etc. Rattrapage naturel : rien n'empêche de valider plusieurs
// jours déjà débloqués le même jour si l'utilisateur a pris du retard, seul le fait d'aller
// PLUS VITE que le calendrier est bloqué (voir bulk-save / ensureSeriesChallengesStarted, qui
// inscrivent tous les jours en IN_PROGRESS d'un coup dès la création/l'inscription — sans ce
// verrou, rien n'empêchait de tout valider en une seule fois).
// Partagée avec GET /api/challenges/by-series/:seriesName (indique au front l'état de chaque
// défi) et POST /api/challenges/:id/complete (fait respecter la règle), pour ne jamais faire
// diverger le calcul entre affichage et application réelle. Extrait dans son propre fichier
// (sans dépendance Prisma) pour rester testable unitairement sans base de données.
export function seriesDayNumber(title) {
  const m = /\d+/.exec(title);
  return m ? Number.parseInt(m[0], 10) : null;
}

export function daysElapsedSince(startDate) {
  const startUTC = new Date(startDate);
  startUTC.setUTCHours(0, 0, 0, 0);
  const todayUTC = new Date();
  todayUTC.setUTCHours(0, 0, 0, 0);
  return Math.round((todayUTC - startUTC) / 86_400_000);
}

// Renvoie null si le défi n'est pas verrouillé, sinon des infos sur son verrou. `dayNumber` sans
// numéro identifiable (ex: les 5 défis variés générés sans durée précisée, voir le prompt système
// IA) n'est jamais verrouillé — l'ordre n'a alors aucun sens à imposer. Jour 1 jamais verrouillé
// non plus (rien à attendre avant de commencer).
//
// Ancré sur la DERNIÈRE VALIDATION (jour N-1) plutôt que sur la date de début de la série : le
// jour N ne devient complétable qu'un jour (fuseau UTC) après que l'utilisateur a validé le jour
// N-1, quelle que soit la date à laquelle il a rejoint la série. Une série mise de côté pendant des
// semaines ne se retrouve donc plus intégralement débloquée au retour (l'ancien calcul, basé sur le
// temps écoulé depuis le début de la série, permettait ça) — seul le jour qui suit le dernier
// vraiment complété continue de compter, tout le reste reste bloqué tant que ce jour précédent
// n'est pas fait.
export function seriesLockInfo(dayNumber, progressByDayNumber) {
  if (dayNumber === null || dayNumber <= 1) return null;
  const prev = progressByDayNumber.get(dayNumber - 1);
  if (!prev || prev.status !== 'COMPLETED' || !prev.completedAt) {
    return { previousDayIncomplete: true, daysUntilUnlock: null };
  }
  const daysUntilUnlock = 1 - daysElapsedSince(prev.completedAt);
  return daysUntilUnlock > 0 ? { previousDayIncomplete: false, daysUntilUnlock } : null;
}
