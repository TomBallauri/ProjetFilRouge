// Petits calculs dérivés de la série en cours (voir la carte "streak" de la page d'accueil,
// UQuail.tsx) — extraits pour être testables indépendamment du rendu.

const MILESTONES = [7, 14, 30, 60, 100];

// +5% de récompenses par palier de 7 jours complet, plafonné à ×3.
export function streakMultiplier(streak: number): number {
  return Math.min(3, Math.round((1 + Math.floor(streak / 7) * 0.05) * 100) / 100);
}

// Prochain palier de récompense à atteindre (100 une fois tous les paliers dépassés).
export function nextStreakMilestone(streak: number): number {
  return MILESTONES.find(m => m > streak) ?? 100;
}

// Progression (0..1) dans la semaine en cours, pour la barre visuelle vers le prochain palier.
export function streakWeekProgress(streak: number): number {
  return (streak % 7) / 7;
}
