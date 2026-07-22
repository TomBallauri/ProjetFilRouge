import { StreakService } from '../../services/StreakService.js';
import { prisma } from './prisma.js';

export const streakService = new StreakService(prisma);
