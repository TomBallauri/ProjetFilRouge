import { DEFAULT_AVATAR } from './config.js';
import { StreakService } from '../../services/StreakService.js';

// Ne jamais renvoyer le hash du mot de passe au client, même pour son propre compte.
export const sanitizeUser = (user) => {
  const { password, ...safe } = user;
  return {
    ...safe,
    avatar: safe.avatar || DEFAULT_AVATAR,
    currentStreak: StreakService.effectiveStreak(user),
  };
};
