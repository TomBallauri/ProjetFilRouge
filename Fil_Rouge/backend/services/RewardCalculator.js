// Logique de calcul des récompenses (pièces / XP) — générique et réutilisable :
// ni ce module ni les classes qu'il expose ne connaissent la notion de "défi",
// de "série" ou de "groupe". Ils savent uniquement combiner des multiplicateurs
// et convertir de l'XP en niveau. Toute future fonctionnalité qui distribue des
// récompenses (achat remboursé, événement saisonnier, etc.) peut les réutiliser
// telles quelles.

export class GroupBonus {
  static PER_MEMBER_BONUS = 0.1;

  constructor(groupSize = 1) {
    this.groupSize = Math.max(1, groupSize);
  }

  get multiplier() {
    return 1 + GroupBonus.PER_MEMBER_BONUS * (this.groupSize - 1);
  }
}

export class LevelProgression {
  static XP_PER_LEVEL = 1000;

  static levelForXp(xp) {
    return Math.floor(xp / LevelProgression.XP_PER_LEVEL) + 1;
  }
}

export class RewardCalculator {
  constructor({ streakMultiplier = 1, dailyMultiplier = 1, groupMultiplier = 1 } = {}) {
    this.streakMultiplier = streakMultiplier;
    this.dailyMultiplier = dailyMultiplier;
    this.groupMultiplier = groupMultiplier;
  }

  get totalMultiplier() {
    return this.streakMultiplier * this.dailyMultiplier * this.groupMultiplier;
  }

  coinsFor(baseCoins) {
    return Math.floor(baseCoins * this.totalMultiplier);
  }

  xpFor(baseXp) {
    return Math.floor(baseXp * this.totalMultiplier);
  }
}
