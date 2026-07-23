// Logique spécifique au domaine "streak" (série de jours consécutifs) —
// isolée ici pour ne pas polluer les routes HTTP avec des règles métier.
// Contrairement à RewardCalculator (générique), cette classe est propre à
// une activité précise : elle sait ce qu'est un "jour", un "palier" et une
// "streak perdue".
//
// L'accès aux données passe par le client Prisma injecté au constructeur —
// aucune route n'appelle prisma.user.findUnique/update directement pour la
// streak, tout passe par ce service. Si le mode de stockage changeait un
// jour, seul ce fichier serait à adapter.

export const STREAK_MILESTONES = [
  { days: 7, coins: 100, xp: 200, label: '7 jours de streak !' },
  { days: 14, coins: 250, xp: 500, label: '14 jours de streak !' },
  { days: 30, coins: 700, xp: 1500, label: '30 jours de streak !', cosmeticName: 'Cadre Flamme' },
  { days: 60, coins: 1500, xp: 3000, label: '60 jours de streak !' },
  { days: 100, coins: 3000, xp: 5000, label: '100 jours de streak !', cosmeticName: 'Cadre Légendaire' },
];

export class StreakService {
  constructor(prisma) {
    this.prisma = prisma;
  }

  static multiplierFor(streak) {
    return Math.min(3, Math.round((1 + Math.floor(streak / 7) * 0.05) * 100) / 100);
  }

  static milestoneFor(oldStreak, newStreak) {
    for (const m of STREAK_MILESTONES) {
      if (oldStreak < m.days && newStreak >= m.days) return m;
    }
    return null;
  }

  // `currentStreak` n'est mis à jour qu'au moment où l'utilisateur complète un défi
  // (voir updateForUser) — tant qu'il ne complète rien, la valeur stockée en base reste
  // celle de sa dernière activité, même si trop de jours se sont écoulés entre-temps et
  // que la streak est en réalité perdue. On calcule donc ici la valeur réellement à jour
  // pour l'affichage (login, /me, classement...), sans dépendre d'une reconnexion ou
  // d'une nouvelle completion pour que ça se répercute.
  static effectiveStreak(user) {
    if (!user.currentStreak || !user.lastStreakDate) return user.currentStreak ?? 0;
    const todayUTC = new Date();
    todayUTC.setUTCHours(0, 0, 0, 0);
    const last = new Date(user.lastStreakDate);
    last.setUTCHours(0, 0, 0, 0);
    const diffDays = Math.round((todayUTC - last) / 86_400_000);
    return diffDays > 1 ? 0 : user.currentStreak;
  }

  async updateForUser(userId) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) return null;

    const todayUTC = new Date();
    todayUTC.setUTCHours(0, 0, 0, 0);

    const last = user.lastStreakDate ? new Date(user.lastStreakDate) : null;
    if (last) last.setUTCHours(0, 0, 0, 0);

    const diffDays = last ? Math.round((todayUTC - last) / 86_400_000) : -1;

    // Déjà mise à jour aujourd'hui — rien à faire
    if (diffDays === 0) return { user, streakUpdated: false, milestone: null };

    const oldStreak = user.currentStreak;
    // Continue la streak si fait hier ; sinon on repart de 1 aujourd'hui — que ce soit la
    // toute première activité ou la reprise après une streak perdue, le jour où l'utilisateur
    // agit compte toujours comme le jour 1 de la nouvelle streak (jamais 0).
    const newStreak = diffDays === 1 ? oldStreak + 1 : 1;
    const longestStreak = Math.max(user.longestStreak, newStreak);
    const milestone = StreakService.milestoneFor(oldStreak, newStreak);

    const updateData = {
      currentStreak: newStreak,
      longestStreak,
      lastStreakDate: todayUTC,
    };

    if (milestone) {
      const newXp = user.xp + milestone.xp;
      updateData.coins = { increment: milestone.coins };
      updateData.xp = newXp;
      updateData.level = Math.floor(newXp / 1000) + 1;
    }

    const updated = await this.prisma.user.update({ where: { id: userId }, data: updateData });

    if (milestone?.cosmeticName) {
      await this.awardCosmetic(userId, milestone.cosmeticName);
    }

    return { user: updated, streakUpdated: true, newStreak, milestone };
  }

  async awardCosmetic(userId, cosmeticName) {
    const cosmetic = await this.prisma.cosmetic.findFirst({ where: { name: cosmeticName } });
    if (!cosmetic) return;
    const alreadyOwned = await this.prisma.userCosmetic.findUnique({
      where: { userId_cosmeticId: { userId, cosmeticId: cosmetic.id } },
    });
    if (!alreadyOwned) {
      await this.prisma.userCosmetic.create({ data: { userId, cosmeticId: cosmetic.id } });
    }
  }
}
