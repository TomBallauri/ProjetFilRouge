import { Router } from 'express';
import jwt from 'jsonwebtoken';
import Groq from 'groq-sdk';
import { prisma } from '../lib/prisma.js';
import { SECRET, authMiddleware, isAdmin } from '../lib/auth.js';
import { sanitizeUser } from '../lib/userUtils.js';
import { streakService } from '../lib/streak.js';
import { RewardCalculator, GroupBonus, LevelProgression } from '../../services/RewardCalculator.js';
import { StreakService } from '../../services/StreakService.js';
import {
  seriesGroupReady,
  expireStaleInvites,
  GROUP_LIST_INCLUDE,
} from '../lib/groupHelpers.js';
import { planGroups, paginateKeys, orderRowsByKeys } from '../lib/seriesPagination.js';
import { aiGenerateLimiter } from '../lib/rateLimiters.js';

const DAILY_BONUS_MULTIPLIER = 1.5;

async function getDailyChallenge() {
  const count = await prisma.challenge.count({ where: { isPublic: true } });
  if (count === 0) return null;
  const today = new Date();
  const seed = today.getUTCFullYear() * 10000 + (today.getUTCMonth() + 1) * 100 + today.getUTCDate();
  const idx = seed % count;
  const rows = await prisma.challenge.findMany({
    where: { isPublic: true },
    orderBy: { id: 'asc' },
    skip: idx,
    take: 1,
  });
  return rows[0] ?? null;
}

const router = Router();

router.get('/api/challenges', async (req, res) => {
  try {
    const { category, difficulty, search } = req.query;
    const skip  = Math.max(0, parseInt(req.query.skip)  || 0);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 10));
    const authHeader = req.headers.authorization;
    let currentUserId = null;
    if (authHeader) {
      try { currentUserId = jwt.verify(authHeader.split(' ')[1], SECRET).userId; } catch {}
    }
    const visibilityClause = currentUserId
      ? { OR: [{ isPublic: true }, { createdBy: currentUserId }] }
      : { isPublic: true };

    const where = {
      ...visibilityClause,
      ...(category   ? { category }                       : {}),
      ...(difficulty ? { difficulty }                     : {}),
      ...(search     ? { title: { contains: search, mode: 'insensitive' } } : {}),
    };

    // Phase 1 (légère) : juste de quoi déterminer l'ordre et le regroupement par série,
    // sans le join creator ni le _count — évite de payer le coût de l'include complet
    // pour l'ensemble filtré entier à chaque appel de "Charger plus".
    const keyOf = (c) => c.seriesName ?? `solo-${c.id}`;
    // `id` en tri secondaire : sans lui, les lignes créées à la même milliseconde (courant
    // pour les défis générés par lot par l'IA) n'ont pas d'ordre stable, et un groupe pourrait
    // apparaître deux fois — ou jamais — entre deux appels successifs de "Charger plus".
    const lightRows = await prisma.challenge.findMany({
      where,
      select: { id: true, seriesName: true },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });
    const { keys, firstRowByKey } = planGroups(lightRows, keyOf);
    const { pageKeys, total, hasMore } = paginateKeys(keys, skip, limit);

    if (pageKeys.length === 0) {
      return res.json({ challenges: [], total, hasMore });
    }

    // Phase 2 : l'include coûteux ne porte que sur les groupes réellement affichés sur la page.
    const seriesNames = [];
    const soloIds = [];
    for (const key of pageKeys) {
      const rep = firstRowByKey.get(key);
      if (rep.seriesName) seriesNames.push(rep.seriesName); else soloIds.push(rep.id);
    }
    const pageRows = await prisma.challenge.findMany({
      where: {
        AND: [
          where,
          { OR: [
            ...(seriesNames.length ? [{ seriesName: { in: seriesNames } }] : []),
            ...(soloIds.length ? [{ id: { in: soloIds } }] : []),
          ] },
        ],
      },
      include: {
        creator: { select: { id: true, username: true, avatar: true } },
        _count: { select: { participants: true } }
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });
    const challenges = orderRowsByKeys(pageRows, keyOf, pageKeys);

    res.json({ challenges, total, hasMore });
  } catch (error) {
    res.status(500).json({ error: "Erreur lors de la récupération des défis" });
  }
});

// Tous les défis d'une série en un seul appel (non paginé) — utilisé par le frontend pour afficher
// une série de façon cohérente sans dépendre de la pagination des listes "en cours"/"terminés".
router.get('/api/challenges/by-series/:seriesName', async (req, res) => {
  try {
    const seriesName = decodeURIComponent(req.params.seriesName);
    const authHeader = req.headers.authorization;
    let currentUserId = null;
    if (authHeader) {
      try { currentUserId = jwt.verify(authHeader.split(' ')[1], SECRET).userId; } catch {}
    }
    const visibilityClause = currentUserId
      ? { OR: [{ isPublic: true }, { createdBy: currentUserId }] }
      : { isPublic: true };
    const challenges = await prisma.challenge.findMany({
      where: { seriesName, ...visibilityClause },
      include: {
        creator: { select: { id: true, username: true, avatar: true } },
        _count: { select: { participants: true } }
      }
    });
    res.json(challenges);
  } catch (error) {
    res.status(500).json({ error: 'Erreur' });
  }
});

router.get('/api/challenges/daily-suggestion', async (req, res) => {
  try {
    const daily = await getDailyChallenge();
    if (!daily) return res.json(null);
    const full = await prisma.challenge.findUnique({
      where: { id: daily.id },
      include: { creator: { select: { id: true, username: true, avatar: true } } }
    });
    res.json({ ...full, dailyBonusMultiplier: DAILY_BONUS_MULTIPLIER });
  } catch (error) {
    res.status(500).json({ error: "Erreur lors de la récupération du défi du jour" });
  }
});

router.get('/api/challenges/:id', async (req, res) => {
  try {
    const challenge = await prisma.challenge.findUnique({
      where: { id: Number(req.params.id) },
      include: {
        creator: { select: { id: true, username: true, avatar: true } },
        _count: { select: { participants: true } }
      }
    });
    if (!challenge) return res.status(404).json({ error: "Défi non trouvé" });
    res.json(challenge);
  } catch (error) {
    res.status(400).json({ error: "Erreur lors de la récupération du défi" });
  }
});

router.post('/api/challenges', async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'Token manquant' });
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, SECRET);
    const { title, description, difficulty, category, isPublic } = req.body;
    if (!title || !description || !difficulty || !category) {
      return res.status(400).json({ error: "Champs requis manquants" });
    }
    const rewards = { EASY: { coins: 50, xp: 100 }, MEDIUM: { coins: 150, xp: 300 }, HARD: { coins: 350, xp: 700 }, EXPERT: { coins: 700, xp: 1500 } };
    const r = rewards[difficulty] || rewards.EASY;
    const challenge = await prisma.challenge.create({
      data: { title, description, difficulty, category, coinReward: r.coins, xpReward: r.xp, createdBy: decoded.userId, isPublic: isPublic !== false }
    });
    res.json(challenge);
  } catch (error) {
    res.status(400).json({ error: "Erreur lors de la création du défi" });
  }
});

// ─── ADMIN : gestion complète des défis ──────────────────────────────────────

router.get('/api/admin/challenges', isAdmin, async (req, res) => {
  try {
    const challenges = await prisma.challenge.findMany({
      include: {
        creator: { select: { id: true, username: true } },
        _count: { select: { participants: true } },
      },
      orderBy: { id: 'desc' },
    });
    res.json(challenges);
  } catch (error) {
    res.status(500).json({ error: "Erreur lors de la récupération des défis" });
  }
});

router.post('/api/admin/challenges', isAdmin, async (req, res) => {
  const { title, description, difficulty, category, coinReward, xpReward, isPublic, isDefault, seriesName } = req.body;
  if (!title || !description || !difficulty || !category) {
    return res.status(400).json({ error: "Champs requis manquants" });
  }
  try {
    const created = await prisma.challenge.create({
      data: {
        title, description, difficulty, category,
        coinReward: coinReward ?? 50, xpReward: xpReward ?? 100,
        isPublic: isPublic !== false, isDefault: !!isDefault,
        seriesName: seriesName || null,
        createdBy: req.user.id,
      },
    });
    res.json(created);
  } catch (error) {
    res.status(400).json({ error: "Impossible de créer le défi" });
  }
});

router.put('/api/admin/challenges/:id', isAdmin, async (req, res) => {
  const { title, description, difficulty, category, coinReward, xpReward, isPublic, isDefault, seriesName } = req.body;
  try {
    const updated = await prisma.challenge.update({
      where: { id: Number(req.params.id) },
      data: {
        title, description, difficulty, category, coinReward, xpReward,
        isPublic, isDefault, seriesName: seriesName || null,
      },
    });
    res.json(updated);
  } catch (error) {
    res.status(400).json({ error: "Impossible de mettre à jour le défi" });
  }
});

router.delete('/api/admin/challenges/:id', isAdmin, async (req, res) => {
  try {
    await prisma.challenge.delete({ where: { id: Number(req.params.id) } });
    res.json({ message: 'Défi supprimé' });
  } catch (error) {
    res.status(400).json({ error: "Impossible de supprimer ce défi (probablement encore lié à des participants)" });
  }
});

router.post('/api/challenges/:id/start', async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'Token manquant' });
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, SECRET);
    const challengeId = Number(req.params.id);
    const challenge = await prisma.challenge.findUnique({ where: { id: challengeId } });
    if (!challenge) return res.status(404).json({ error: "Défi non trouvé" });
    // isPublic ne filtre que l'affichage dans la liste : sans ce contrôle, n'importe quel
    // utilisateur connecté peut démarrer/compléter un défi privé d'un autre en devinant son
    // id (séquentiel) et en tirer coins/xp, alors qu'il ne devrait même pas pouvoir le voir.
    if (!challenge.isPublic && challenge.createdBy !== decoded.userId) {
      return res.status(403).json({ error: "Défi non accessible" });
    }
    const existing = await prisma.userChallenge.findUnique({
      where: { userId_challengeId: { userId: decoded.userId, challengeId } }
    });
    if (existing) return res.status(400).json({ error: "Défi déjà commencé" });
    const uc = await prisma.userChallenge.create({
      data: { userId: decoded.userId, challengeId, status: 'IN_PROGRESS' }
    });
    res.json(uc);
  } catch (error) {
    res.status(400).json({ error: "Erreur lors du démarrage du défi" });
  }
});

router.post('/api/challenges/:id/complete', async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'Token manquant' });
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, SECRET);
    const challengeId = Number(req.params.id);
    const uc = await prisma.userChallenge.findUnique({
      where: { userId_challengeId: { userId: decoded.userId, challengeId } }
    });
    if (!uc) return res.status(404).json({ error: "Défi non commencé" });
    if (uc.status === 'COMPLETED') return res.status(400).json({ error: "Défi déjà complété" });
    const challenge = await prisma.challenge.findUnique({ where: { id: challengeId } });
    await prisma.userChallenge.update({
      where: { id: uc.id },
      data: { status: 'COMPLETED', completedAt: new Date() }
    });
    const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
    let streakResult = null;
    try { streakResult = await streakService.updateForUser(decoded.userId); } catch {}
    const freshUser = streakResult?.user ?? user;
    const streakMultiplier = StreakService.multiplierFor(freshUser?.currentStreak ?? 0);
    const dailyChallenge = await getDailyChallenge();
    const isDailyBonus = dailyChallenge?.id === challengeId;
    const dailyMultiplier = isDailyBonus ? DAILY_BONUS_MULTIPLIER : 1;

    // Bonus de groupe : +10% de récompenses par membre supplémentaire ayant
    // rejoint le groupe du défi (2 joueurs = x1.1, 3 = x1.2, 4 = x1.3...).
    // Couvre les deux types de groupe : défi unique (ChallengeGroup) et série (SeriesGroup).
    let groupSize = 1;
    const challengeGroup = await prisma.challengeGroup.findFirst({
      where: { challengeId, members: { some: { userId: decoded.userId, status: { in: ['JOINED', 'COMPLETED'] } } } },
      include: { members: true },
    });
    if (challengeGroup) {
      groupSize = challengeGroup.members.filter(m => m.status === 'JOINED' || m.status === 'COMPLETED').length;
    } else if (challenge.seriesName && seriesGroupReady()) {
      const seriesGroup = await prisma.seriesGroup.findFirst({
        where: { seriesName: challenge.seriesName, members: { some: { userId: decoded.userId, status: 'JOINED' } } },
        include: { members: true },
      });
      if (seriesGroup) {
        groupSize = seriesGroup.members.filter(m => m.status === 'JOINED').length;
      }
    }
    const groupBonus = new GroupBonus(groupSize);
    const reward = new RewardCalculator({
      streakMultiplier,
      dailyMultiplier,
      groupMultiplier: groupBonus.multiplier,
    });

    const coinsEarned = reward.coinsFor(challenge.coinReward);
    const xpEarned = reward.xpFor(challenge.xpReward);
    const newXp = freshUser.xp + xpEarned;
    const newLevel = LevelProgression.levelForXp(newXp);
    const updatedUser = await prisma.user.update({
      where: { id: decoded.userId },
      data: { coins: { increment: coinsEarned }, xp: newXp, level: newLevel }
    });
    res.json({
      message: "Défi complété !",
      coinsEarned, xpEarned, multiplier: streakMultiplier,
      isDailyBonus, dailyMultiplier,
      groupSize, groupBonusMultiplier: groupBonus.multiplier,
      streak: { current: freshUser.currentStreak, milestone: streakResult?.milestone ?? null },
      user: sanitizeUser(updatedUser)
    });
  } catch (error) {
    res.status(400).json({ error: "Erreur lors de la complétion du défi" });
  }
});

router.get('/api/users/me/challenges', async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'Token manquant' });
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, SECRET);
    const skip   = Math.max(0, parseInt(req.query.skip)  || 0);
    const limit  = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    const status = req.query.status; // optional: 'IN_PROGRESS' | 'COMPLETED'
    const where  = { userId: decoded.userId, ...(status ? { status } : {}) };

    // Même pattern en 2 temps que GET /api/challenges : une série compte comme UN seul
    // objet pour la pagination, comme un défi solo, mais l'include coûteux (challenge
    // complet) ne porte que sur les groupes réellement affichés sur la page.
    const keyOf = (uc) => uc.challenge.seriesName ?? `solo-${uc.challengeId}`;
    const [lightRows, totalCompleted, totalInProgress] = await Promise.all([
      prisma.userChallenge.findMany({
        where,
        select: { id: true, challengeId: true, challenge: { select: { seriesName: true } } },
        orderBy: [{ startedAt: 'desc' }, { id: 'desc' }],
      }),
      prisma.userChallenge.count({ where: { userId: decoded.userId, status: 'COMPLETED' } }),
      prisma.userChallenge.count({ where: { userId: decoded.userId, status: 'IN_PROGRESS' } }),
    ]);
    const { keys, firstRowByKey } = planGroups(lightRows, keyOf);
    const { pageKeys, total, hasMore } = paginateKeys(keys, skip, limit);

    if (pageKeys.length === 0) {
      return res.json({ challenges: [], total, totalCompleted, totalInProgress, hasMore });
    }

    const seriesNames = [];
    const soloChallengeIds = [];
    for (const key of pageKeys) {
      const rep = firstRowByKey.get(key);
      if (rep.challenge.seriesName) seriesNames.push(rep.challenge.seriesName); else soloChallengeIds.push(rep.challengeId);
    }
    const pageRows = await prisma.userChallenge.findMany({
      where: {
        AND: [
          where,
          { OR: [
            ...(seriesNames.length ? [{ challenge: { seriesName: { in: seriesNames } } }] : []),
            ...(soloChallengeIds.length ? [{ challengeId: { in: soloChallengeIds } }] : []),
          ] },
        ],
      },
      include: { challenge: true },
      orderBy: [{ startedAt: 'desc' }, { id: 'desc' }],
    });
    const challenges = orderRowsByKeys(pageRows, keyOf, pageKeys);

    res.json({ challenges, total, totalCompleted, totalInProgress, hasMore });
  } catch (error) {
    res.status(401).json({ error: 'Token invalide' });
  }
});

// Dashboard: toutes les données utilisateur en un seul appel
router.get('/api/users/me/dashboard', authMiddleware, async (req, res) => {
  const userId = req.userId;
  try {
    await expireStaleInvites();

    // Une série compte comme UN seul objet pour la pagination, comme un défi solo — même
    // correctif que sur GET /api/challenges et /api/users/me/challenges. Le dashboard
    // n'affiche jamais que la première page : on ne va donc chercher les lignes complètes
    // (include challenge) que pour les quelques groupes réellement montrés, pas pour tout
    // l'historique de l'utilisateur.
    const keyOf = (uc) => uc.challenge.seriesName ?? `solo-${uc.challengeId}`;
    const loadFirstPage = async (status, limit) => {
      const lightRows = await prisma.userChallenge.findMany({
        where: { userId, status },
        select: { id: true, challengeId: true, challenge: { select: { seriesName: true } } },
        orderBy: [{ startedAt: 'desc' }, { id: 'desc' }],
      });
      const { keys, firstRowByKey } = planGroups(lightRows, keyOf);
      const { pageKeys, total, hasMore } = paginateKeys(keys, 0, limit);
      if (pageKeys.length === 0) return { challenges: [], total, hasMore };

      const seriesNames = [];
      const soloChallengeIds = [];
      for (const key of pageKeys) {
        const rep = firstRowByKey.get(key);
        if (rep.challenge.seriesName) seriesNames.push(rep.challenge.seriesName); else soloChallengeIds.push(rep.challengeId);
      }
      const pageRows = await prisma.userChallenge.findMany({
        where: {
          userId, status,
          OR: [
            ...(seriesNames.length ? [{ challenge: { seriesName: { in: seriesNames } } }] : []),
            ...(soloChallengeIds.length ? [{ challengeId: { in: soloChallengeIds } }] : []),
          ],
        },
        include: { challenge: true },
        orderBy: [{ startedAt: 'desc' }, { id: 'desc' }],
      });
      return { challenges: orderRowsByKeys(pageRows, keyOf, pageKeys), total, hasMore };
    };

    const [inProgress, completed, allStatuses, groups, pendingSeriesInvites] = await Promise.all([
      loadFirstPage('IN_PROGRESS', 10),
      loadFirstPage('COMPLETED', 10),
      prisma.userChallenge.findMany({
        where: { userId },
        select: { challengeId: true, status: true },
      }),
      prisma.challengeGroup.findMany({
        where: { members: { some: { userId } } },
        include: GROUP_LIST_INCLUDE,
        orderBy: { createdAt: 'desc' },
      }),
      seriesGroupReady() ? prisma.seriesGroup.findMany({
        where: { members: { some: { userId, status: 'INVITED' } } },
        include: {
          creator: { select: { id: true, username: true, avatar: true } },
          members: { include: { user: { select: { id: true, username: true, avatar: true } } } },
        },
      }) : Promise.resolve([]),
    ]);

    res.json({
      challenges: allStatuses,
      inProgress,
      completed,
      groups,
      pendingSeriesInvites,
    });
  } catch (error) {
    res.status(500).json({ error: 'Erreur' });
  }
});

// ─── IA GÉNÉRATION DE DÉFIS ──────────────────────────────────────────────────

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
console.log('[AI] Groq API key:', process.env.GROQ_API_KEY ? `chargée (${process.env.GROQ_API_KEY.slice(0, 8)}...)` : '❌ MANQUANTE');

const AI_SYSTEM_PROMPT = `Tu es un assistant de création de défis personnalisés pour une application de gamification.

PROCESSUS:
1. L'utilisateur décrit son objectif
2. Tu peux poser au maximum 2 questions de suivi, une à la fois, pour mieux cerner ses besoins
3. Dès que tu as assez d'informations, génère les défis

NOMBRE DE DÉFIS À GÉNÉRER:
- Programme sur N jours → N défis (un par jour, nommés "Jour 1:", "Jour 2:", etc.)
- Sans durée précisée → 5 défis variés

CATÉGORIES (utilise EXACTEMENT ces valeurs):
GAMING, SPORT, CUISINE, FITNESS, CREATIVITY, KNOWLEDGE, SOCIAL, NATURE, MUSIC, WELLNESS, DIY, OTHERS

Correspondances:
- Jardinage, plein air, écologie, randonnée → NATURE
- Instrument, chant, composition → MUSIC
- Méditation, bien-être, sommeil, stress → WELLNESS
- Bricolage, artisanat, forgeron, menuiserie, couture → DIY
- Tout le reste → OTHERS

DIFFICULTÉS (utilise EXACTEMENT ces valeurs): EASY, MEDIUM, HARD, EXPERT

Titres: max 80 caractères. Descriptions: max 500 caractères, claires et actionnables.

FORMAT DE RÉPONSE — JSON uniquement, rien d'autre:
Question: {"type":"question","content":"Ta question"}
Défis: {"type":"challenges","challenges":[{"title":"...","description":"...","category":"...","difficulty":"..."}]}`;

router.post('/api/challenges/ai-generate', authMiddleware, aiGenerateLimiter, async (req, res) => {
  const { history } = req.body;
  if (!history || !Array.isArray(history) || history.length === 0) {
    return res.status(400).json({ error: 'Historique de conversation requis' });
  }
  try {
    const response = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      max_tokens: 2048,
      messages: [
        { role: 'system', content: AI_SYSTEM_PROMPT },
        ...history.map(m => ({ role: m.role, content: m.content })),
      ],
    });
    const text = response.choices[0].message.content.trim();
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    try {
      const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : text);
      res.json(parsed);
    } catch {
      res.json({ type: 'question', content: text });
    }
  } catch (error) {
    console.error('AI generation error:', error);
    res.status(500).json({ error: 'Erreur lors de la génération par IA' });
  }
});

router.post('/api/challenges/bulk-save', async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'Token manquant' });
  const token = authHeader.split(' ')[1];
  const { challenges, seriesName } = req.body;
  if (!challenges || !Array.isArray(challenges) || challenges.length === 0) {
    return res.status(400).json({ error: 'Défis requis' });
  }
  // Aucune série légitime ne dépasse quelques semaines : sans plafond, un body forgé
  // pourrait déclencher des milliers de créations concurrentes en un seul appel.
  if (challenges.length > 50) {
    return res.status(400).json({ error: 'Trop de défis en une seule fois (50 maximum).' });
  }
  try {
    const decoded = jwt.verify(token, SECRET);
    const rewards = { EASY: { coins: 50, xp: 100 }, MEDIUM: { coins: 150, xp: 300 }, HARD: { coins: 350, xp: 700 }, EXPERT: { coins: 700, xp: 1500 } };
    let resolvedSeries = seriesName && typeof seriesName === 'string' ? seriesName.trim().slice(0, 80) || null : null;

    // Le nom de série est dérivé du prompt utilisateur : deux prompts similaires ("Me mettre au sport")
    // tomberaient sinon sur le même nom et fusionneraient leur progression avec une série existante
    // sans rapport (même complétée par quelqu'un d'autre). On garantit donc un nom toujours neuf.
    if (resolvedSeries) {
      try {
        const base = resolvedSeries;
        for (let suffix = 2; await prisma.challenge.count({ where: { seriesName: resolvedSeries } }) > 0; suffix++) {
          resolvedSeries = `${base} (${suffix})`.slice(0, 80);
        }
      } catch {
        // Prisma client not yet regenerated — skip dedup, fall back to no series name
        resolvedSeries = null;
      }
    }

    const createOne = ({ title, description, difficulty, category, isPublic }, withSeries) => {
      const r = rewards[difficulty] || rewards.EASY;
      return prisma.challenge.create({
        data: {
          title, description, difficulty, category,
          coinReward: r.coins, xpReward: r.xp,
          createdBy: decoded.userId,
          isPublic: isPublic !== false,
          ...(withSeries && resolvedSeries ? { seriesName: resolvedSeries } : {}),
          participants: { create: { userId: decoded.userId, status: 'IN_PROGRESS' } },
        },
      });
    };
    let created;
    try {
      created = await Promise.all(challenges.map(c => createOne(c, true)));
    } catch {
      // Prisma client not yet regenerated — retry without seriesName
      created = await Promise.all(challenges.map(c => createOne(c, false)));
    }
    res.json(created);
  } catch (error) {
    res.status(400).json({ error: 'Erreur lors de la sauvegarde des défis' });
  }
});

export default router;
