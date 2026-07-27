import { DEFAULT_AVATAR } from './config.js';
import { StreakService } from '../../services/StreakService.js';

// Fragment Prisma `select` réutilisé partout où un mini-profil (avatar + cadre équipé) doit
// s'afficher — amis, membres de groupe, messages de tchat, recherche... Centralisé ici pour que
// l'ajout d'un nouvel affichage n'oublie pas d'inclure les cosmétiques équipés (sinon le cadre
// équipé ne s'affiche pas — l'avatar tombe silencieusement en repli "sans cadre").
export const USER_MINI_SELECT = {
  id: true, username: true, avatar: true,
  cosmetics: {
    where: { equipped: true },
    select: { cosmeticId: true, equipped: true, cosmetic: { select: { id: true, name: true, type: true, rarity: true, imageUrl: true } } },
  },
};

// Ne jamais renvoyer le hash du mot de passe au client, même pour son propre compte.
export const sanitizeUser = (user) => {
  const { password, ...safe } = user;
  return {
    ...safe,
    avatar: safe.avatar || DEFAULT_AVATAR,
    currentStreak: StreakService.effectiveStreak(user),
  };
};
