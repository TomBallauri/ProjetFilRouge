import { Router } from 'express';
import jwt from 'jsonwebtoken';
import Groq, { RateLimitError } from 'groq-sdk';
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
import { withTranslatedChallenge, withTranslatedChallenges, withTranslatedUserChallenges } from '../lib/translateContent.js';
import { TITLE_MAX, DESCRIPTION_MAX, SERIES_NAME_MAX, CHAT_MESSAGE_MAX, lengthError } from '../lib/textLimits.js';
import { seriesDayNumber, seriesLockInfo } from '../lib/seriesLock.js';

const DAILY_BONUS_MULTIPLIER = 1.5;

// `userId` optionnel : quand fourni, écarte les défis déjà complétés par CET utilisateur avant
// de piocher — sinon la "suggestion du jour" (même calcul, voir la route daily-suggestion)
// pouvait retomber sur un défi que l'utilisateur avait déjà terminé. Ne PAS passer userId lors
// de l'appel utilisé pour le bonus de récompense (voir POST /api/challenges/:id/complete) : à cet
// endroit le défi vient tout juste d'être marqué COMPLETED, donc le filtrer changerait l'index et
// casserait la comparaison avec le défi du jour "officiel" — un défi ne peut de toute façon jamais
// être complété deux fois (contrainte unique userId+challengeId), donc ce filtre n'y sert à rien.
async function getDailyChallenge(userId) {
  const where = {
    isPublic: true,
    ...(userId ? { participants: { none: { userId, status: 'COMPLETED' } } } : {}),
  };
  const count = await prisma.challenge.count({ where });
  if (count === 0) return null;
  const today = new Date();
  const seed = today.getUTCFullYear() * 10000 + (today.getUTCMonth() + 1) * 100 + today.getUTCDate();
  const idx = seed % count;
  const rows = await prisma.challenge.findMany({
    where,
    orderBy: { id: 'asc' },
    skip: idx,
    take: 1,
  });
  return rows[0] ?? null;
}

// Progression de CET utilisateur pour chaque jour numéroté d'une série, en une seule requête —
// partagée par seriesLockInfo ci-dessous (affichage ET application), pour ne jamais refaire une
// requête par défi.
async function getSeriesProgressByDayNumber(userId, seriesName) {
  const rows = await prisma.challenge.findMany({
    where: { seriesName },
    select: {
      title: true,
      participants: { where: { userId }, select: { status: true, completedAt: true } },
    },
  });
  const map = new Map();
  for (const c of rows) {
    const dayNumber = seriesDayNumber(c.title);
    if (dayNumber === null || c.participants.length === 0) continue;
    map.set(dayNumber, c.participants[0]);
  }
  return map;
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

    // `AND` de conditions plutôt qu'un simple spread d'objets : `visibilityClause` porte déjà sa
    // propre clé `OR` (voir plus haut) — lui ajouter une seconde clé `OR` pour la recherche via
    // spread aurait silencieusement écrasé la première (une même clé d'objet ne peut valoir
    // qu'une chose), désactivant le filtre de visibilité dès qu'un texte de recherche était tapé.
    const where = {
      AND: [
        visibilityClause,
        ...(category   ? [{ category }]   : []),
        ...(difficulty ? [{ difficulty }] : []),
        // Cherche aussi dans le nom de série (le thème du groupe, ex. "Apprendre à cuisiner") et
        // la description — se limiter au titre du défi ne matchait jamais une recherche sur le nom
        // du groupe, puisque chaque jour a son propre titre ("Jour 1: Salade") qui ne contient pas
        // le nom de la série. Et dans les DEUX langues (titre/description/nom de série ET leurs
        // caches traduits *En/*Fr, voir withTranslatedChallenge) — un défi créé en français reste
        // stocké en français même quand l'utilisateur le voit traduit en anglais à l'écran ; sans
        // chercher aussi dans le cache traduit, un mot anglais ne matchait jamais rien pour ce défi.
        ...(search ? [{ OR: [
          { title: { contains: search, mode: 'insensitive' } },
          { titleEn: { contains: search, mode: 'insensitive' } },
          { titleFr: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } },
          { descriptionEn: { contains: search, mode: 'insensitive' } },
          { descriptionFr: { contains: search, mode: 'insensitive' } },
          { seriesName: { contains: search, mode: 'insensitive' } },
          { seriesNameEn: { contains: search, mode: 'insensitive' } },
          { seriesNameFr: { contains: search, mode: 'insensitive' } },
        ] }] : []),
      ],
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
    const ordered = orderRowsByKeys(pageRows, keyOf, pageKeys);
    const challenges = await withTranslatedChallenges(ordered, req.query.lang);

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
    const rows = await prisma.challenge.findMany({
      where: { seriesName, ...visibilityClause },
      include: {
        creator: { select: { id: true, username: true, avatar: true } },
        _count: { select: { participants: true } }
      },
      // Sans orderBy, Postgres ne garantit aucun ordre stable entre deux appels — c'était la
      // seule requête de tout le fichier à ne pas en avoir. `id` suffit ici (le frontend re-trie
      // de toute façon par numéro de jour extrait du titre, voir SeriesDropdown), mais un ordre
      // instable côté serveur reste une source réelle de "l'ordre change au rechargement".
      orderBy: { id: 'asc' },
    });
    const challenges = await withTranslatedChallenges(rows, req.query.lang);
    // Une seule requête pour la progression de toute la série (partagée par tous ses défis), le
    // reste du calcul se fait en mémoire par défi (voir seriesLockInfo) plutôt que de refaire
    // la requête N fois.
    const progressByDayNumber = currentUserId ? await getSeriesProgressByDayNumber(currentUserId, seriesName) : new Map();
    res.json(challenges.map(c => {
      const dayNumber = seriesDayNumber(c.title);
      const lock = seriesLockInfo(dayNumber, progressByDayNumber);
      return { ...c, daysUntilUnlock: lock?.daysUntilUnlock ?? null, previousDayIncomplete: !!lock?.previousDayIncomplete };
    }));
  } catch (error) {
    res.status(500).json({ error: 'Erreur' });
  }
});

router.get('/api/challenges/daily-suggestion', async (req, res) => {
  try {
    // Optionnel : un visiteur non connecté (ou au token invalide) reçoit la suggestion globale
    // du jour sans exclusion — seule une session valide permet d'écarter ses défis déjà complétés.
    let currentUserId = null;
    const authHeader = req.headers.authorization;
    if (authHeader) {
      try { currentUserId = jwt.verify(authHeader.split(' ')[1], SECRET).userId; } catch {}
    }
    const daily = await getDailyChallenge(currentUserId);
    if (!daily) return res.json(null);
    const full = await prisma.challenge.findUnique({
      where: { id: daily.id },
      include: { creator: { select: { id: true, username: true, avatar: true } } }
    });
    const translated = await withTranslatedChallenge(full, req.query.lang);
    res.json({ ...translated, dailyBonusMultiplier: DAILY_BONUS_MULTIPLIER });
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
    res.json(await withTranslatedChallenge(challenge, req.query.lang));
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
    const { title, description, difficulty, category, isPublic, lang } = req.body;
    if (!title || !description || !difficulty || !category) {
      return res.status(400).json({ error: "Champs requis manquants" });
    }
    const lenErr = lengthError(title, TITLE_MAX, 'Titre') || lengthError(description, DESCRIPTION_MAX, 'Description');
    if (lenErr) return res.status(400).json({ error: lenErr });
    const rewards = { EASY: { coins: 50, xp: 100 }, MEDIUM: { coins: 150, xp: 300 }, HARD: { coins: 350, xp: 700 }, EXPERT: { coins: 700, xp: 1500 } };
    const r = rewards[difficulty] || rewards.EASY;
    // `title`/`description` sont écrits dans la langue de l'interface du créateur au moment de
    // la création — pas toujours le français (voir withTranslatedChallenge). Sans ça, un défi
    // rédigé en anglais ne se retraduisait jamais vers le français (l'ancien système supposait
    // toujours une source française).
    const originalLang = lang === 'en' ? 'en' : 'fr';
    const challenge = await prisma.challenge.create({
      data: { title, description, difficulty, category, coinReward: r.coins, xpReward: r.xp, createdBy: decoded.userId, isPublic: isPublic !== false, originalLang }
    });
    res.json(challenge);
  } catch (error) {
    res.status(400).json({ error: "Erreur lors de la création du défi" });
  }
});

// Modification par l'auteur (pas besoin de repasser par l'admin, ni de supprimer/recréer le
// défi) — réservé au créateur, contrairement à PUT /api/admin/challenges/:id qui est ouvert à
// n'importe quel défi. Les récompenses sont recalculées depuis la difficulté (même barème que la
// création ci-dessus), pas transmises par le client, pour rester cohérent avec le reste de l'app.
router.put('/api/challenges/:id', async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'Token manquant' });
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, SECRET);
    const challengeId = Number(req.params.id);
    const challenge = await prisma.challenge.findUnique({ where: { id: challengeId } });
    if (!challenge) return res.status(404).json({ error: 'Défi non trouvé' });
    if (challenge.createdBy !== decoded.userId) {
      return res.status(403).json({ error: 'Tu ne peux modifier que tes propres défis' });
    }
    const { title, description, difficulty, category, isPublic, lang } = req.body;
    if (!title || !description || !difficulty || !category) {
      return res.status(400).json({ error: 'Champs requis manquants' });
    }
    const lenErr = lengthError(title, TITLE_MAX, 'Titre') || lengthError(description, DESCRIPTION_MAX, 'Description');
    if (lenErr) return res.status(400).json({ error: lenErr });
    const rewards = { EASY: { coins: 50, xp: 100 }, MEDIUM: { coins: 150, xp: 300 }, HARD: { coins: 350, xp: 700 }, EXPERT: { coins: 700, xp: 1500 } };
    const r = rewards[difficulty] || rewards.EASY;
    const updated = await prisma.challenge.update({
      where: { id: challengeId },
      data: {
        title, description, difficulty, category,
        coinReward: r.coins, xpReward: r.xp,
        isPublic: isPublic !== false,
        // La langue du texte édité peut différer de originalLang (ex: défi créé en français,
        // puis modifié pendant que l'interface est en anglais) — on la met à jour ici.
        originalLang: lang === 'en' ? 'en' : 'fr',
        // Le cache de traduction (voir translateContent.js) correspond à l'ANCIEN texte —
        // invalidé dans les DEUX sens ici pour être recalculé au prochain affichage, sinon
        // un défi modifié resterait affiché avec une traduction devenue obsolète.
        titleEn: null, descriptionEn: null,
        titleFr: null, descriptionFr: null,
      },
    });
    res.json(updated);
  } catch (error) {
    res.status(400).json({ error: 'Erreur lors de la modification du défi' });
  }
});

// Suppression par l'auteur. Contrairement à DELETE /api/admin/challenges/:id (qui tente
// bêtement la suppression et renvoie une erreur si une contrainte de clé étrangère existe déjà),
// ici on vérifie explicitement qu'aucun AUTRE joueur n'a rejoint/complété ce défi avant de
// supprimer — un défi de série auto-inscrit toujours son créateur (voir bulk-save), donc bloquer
// dès qu'un participant existe empêcherait systématiquement la suppression de ses propres défis
// tout juste créés, ce qui est exactement le cas qu'on veut débloquer ici.
router.delete('/api/challenges/:id', async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'Token manquant' });
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, SECRET);
    const challengeId = Number(req.params.id);
    const challenge = await prisma.challenge.findUnique({
      where: { id: challengeId },
      include: { participants: true, groups: { include: { members: true } } },
    });
    if (!challenge) return res.status(404).json({ error: 'Défi non trouvé' });
    if (challenge.createdBy !== decoded.userId) {
      return res.status(403).json({ error: 'Tu ne peux supprimer que tes propres défis' });
    }
    const otherParticipant = challenge.participants.some(p => p.userId !== decoded.userId);
    const otherGroupMember = challenge.groups.some(g => g.members.some(m => m.userId !== decoded.userId));
    if (otherParticipant || otherGroupMember) {
      return res.status(400).json({ error: 'Impossible : un autre joueur a déjà rejoint ou complété ce défi.' });
    }
    await prisma.$transaction([
      prisma.challengeGroup.deleteMany({ where: { challengeId } }), // cascade → membres + messages
      prisma.userChallenge.deleteMany({ where: { challengeId } }),
      prisma.challenge.delete({ where: { id: challengeId } }),
    ]);
    res.json({ message: 'Défi supprimé' });
  } catch (error) {
    res.status(400).json({ error: 'Erreur lors de la suppression du défi' });
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
  const lenErr = lengthError(title, TITLE_MAX, 'Titre') || lengthError(description, DESCRIPTION_MAX, 'Description');
  if (lenErr) return res.status(400).json({ error: lenErr });
  try {
    const created = await prisma.challenge.create({
      data: {
        title, description, difficulty, category,
        coinReward: coinReward ?? 50, xpReward: xpReward ?? 100,
        isPublic: isPublic !== false, isDefault: !!isDefault,
        seriesName: seriesName ? seriesName.trim().slice(0, SERIES_NAME_MAX) : null,
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
  const lenErr = lengthError(title, TITLE_MAX, 'Titre') || lengthError(description, DESCRIPTION_MAX, 'Description');
  if (lenErr) return res.status(400).json({ error: lenErr });
  try {
    const updated = await prisma.challenge.update({
      where: { id: Number(req.params.id) },
      data: {
        title, description, difficulty, category, coinReward, xpReward,
        isPublic, isDefault, seriesName: seriesName ? seriesName.trim().slice(0, SERIES_NAME_MAX) : null,
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

    // Déverrouillage progressif par numéro de jour, ancré sur la dernière validation (voir
    // seriesLockInfo) — bloque le fait d'aller plus vite qu'un jour de série par jour calendaire,
    // qu'un jour précédent n'ait pas encore été validé, ou les deux.
    if (challenge.seriesName) {
      const dayNumber = seriesDayNumber(challenge.title);
      const progressByDayNumber = await getSeriesProgressByDayNumber(decoded.userId, challenge.seriesName);
      const lock = seriesLockInfo(dayNumber, progressByDayNumber);
      if (lock) {
        return res.status(400).json({
          error: lock.previousDayIncomplete
            ? 'Termine d\'abord le jour précédent de cette série.'
            : (lock.daysUntilUnlock === 1
              ? 'Ce défi se débloque demain — reviens à ce moment-là !'
              : `Ce défi se débloque dans ${lock.daysUntilUnlock} jours.`),
        });
      }
    }

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
      // `challenge: true` seul n'inclut PAS les relations du défi (son créateur) — sans ça,
      // `challenge.creator` restait toujours undefined pour tout ce qui passe par "En cours"/
      // "Terminés", et l'auteur d'un défi ne pouvait jamais le modifier/supprimer une fois
      // démarré (le bouton crayon/poubelle du frontend teste challenge.creator?.id).
      include: { challenge: { include: { creator: { select: { id: true, username: true, avatar: true } } } } },
      orderBy: [{ startedAt: 'desc' }, { id: 'desc' }],
    });
    const ordered = orderRowsByKeys(pageRows, keyOf, pageKeys);
    const challenges = await withTranslatedUserChallenges(ordered, req.query.lang);

    res.json({ challenges, total, totalCompleted, totalInProgress, hasMore });
  } catch (error) {
    res.status(401).json({ error: 'Token invalide' });
  }
});

// Dates de complétion, sans pagination — alimente le graphique d'activité de la page d'accueil,
// qui a besoin de tout l'historique pour regrouper par jour/semaine/mois côté client. Pas de
// `include: { challenge: true }` comme GET /api/users/me/challenges ci-dessus : une seule colonne
// de dates reste légère même pour un très gros historique, donc pas besoin d'y plafonner le
// nombre de lignes récupérées (voir CompletedChallengesChart.tsx côté frontend).
router.get('/api/users/me/challenges/completed-dates', authMiddleware, async (req, res) => {
  const rows = await prisma.userChallenge.findMany({
    where: { userId: req.userId, status: 'COMPLETED', completedAt: { not: null } },
    select: { completedAt: true },
  });
  res.json({ dates: rows.map(r => r.completedAt) });
});

// Détail des défis complétés sur une plage bornée (bornes incluses) — alimente le clic sur un
// jour passé de la mini-grille "À faire" (voir renderTodaySection côté frontend), qui a besoin
// du défi complet (titre, catégorie...), pas juste sa date comme completed-dates ci-dessus.
// Volontairement séparée de cette dernière plutôt que d'y ajouter `include: { challenge }` : cette
// route n'est jamais appelée sans bornes (la mini-grille ne couvre qu'une semaine), donc jamais à
// risque de traduire tout l'historique d'un compte ancien à chaque affichage.
router.get('/api/users/me/challenges/completed-in-range', authMiddleware, async (req, res) => {
  const from = new Date(req.query.from);
  const to = new Date(req.query.to);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
    return res.status(400).json({ error: 'Plage de dates invalide' });
  }
  const rows = await prisma.userChallenge.findMany({
    where: { userId: req.userId, status: 'COMPLETED', completedAt: { gte: from, lte: to } },
    include: { challenge: { include: { creator: { select: { id: true, username: true, avatar: true } } } } },
    orderBy: { completedAt: 'desc' },
  });
  const translated = await withTranslatedUserChallenges(rows, req.query.lang);
  res.json(translated.map(uc => ({ completedAt: uc.completedAt, challenge: uc.challenge })));
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
        include: { challenge: { include: { creator: { select: { id: true, username: true, avatar: true } } } } },
        orderBy: [{ startedAt: 'desc' }, { id: 'desc' }],
      });
      const ordered = orderRowsByKeys(pageRows, keyOf, pageKeys);
      return { challenges: await withTranslatedUserChallenges(ordered, req.query.lang), total, hasMore };
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

// Codes alignés sur LANGUAGE_TO_HTML_LANG / detectBrowserLanguageCode côté frontend (src/lib/i18n.ts).
const AI_LANGUAGE_NAMES = { fr: 'français', en: 'English', es: 'español', de: 'Deutsch' };

// `langCode` : langue de l'interface de l'utilisateur (envoyée par le frontend, voir la route
// plus bas). Volontairement plus fiable qu'une consigne du style "réponds dans la langue de
// l'utilisateur" laissée à l'appréciation du modèle — testé en réel, un message court et ambigu
// ("Get into sports 🏋️") retombait quand même en français malgré une telle consigne, le français
// dominant largement le reste du prompt. Donner la langue cible explicitement lève l'ambiguïté.
function buildAiSystemPrompt(langCode) {
  const langName = AI_LANGUAGE_NAMES[langCode] ?? AI_LANGUAGE_NAMES.fr;
  return `Tu es un assistant de création de défis personnalisés pour une application de gamification.

LANGUE OBLIGATOIRE POUR TOUTE CETTE CONVERSATION : ${langName}. Réponds strictement dans cette langue — questions de suivi, titres et descriptions compris — même si le message de l'utilisateur est dans une autre langue. Seules les valeurs techniques listées plus bas (catégories, difficultés) doivent rester exactement en anglais telles quelles, quelle que soit la langue de réponse — ce sont des identifiants internes, jamais affichés tels quels.

PROCESSUS:
1. L'utilisateur décrit son objectif
2. Tu peux poser au maximum 2 questions de suivi, une à la fois, pour mieux cerner ses besoins
3. Dès que tu as assez d'informations, génère les défis

NOMBRE DE DÉFIS À GÉNÉRER:
- Programme sur N jours → N défis (un par jour, avec le numéro du jour dans le titre, dans la langue de réponse — ex: "Day 1:" en anglais, "Jour 1:" en français)
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
}

router.post('/api/challenges/ai-generate', authMiddleware, aiGenerateLimiter, async (req, res) => {
  const { history, lang } = req.body;
  if (!history || !Array.isArray(history) || history.length === 0) {
    return res.status(400).json({ error: 'Historique de conversation requis' });
  }
  // Chaque message du chat IA était envoyé tel quel à l'API Groq sans aucune limite — un message
  // de plusieurs milliers de caractères (aucune limite côté frontend non plus avant ce correctif)
  // faisait échouer l'appel à Groq (l'IA renvoyait alors une erreur générique, sans indiquer la
  // vraie cause). Même plafond que les autres messages de tchat de l'app (voir textLimits.js).
  // Le nombre de messages est aussi plafonné : sans ça, un historique forgé de milliers d'entrées
  // gonflerait le prompt envoyé à Groq de la même façon.
  if (history.length > 50) {
    return res.status(400).json({ error: 'Conversation trop longue.' });
  }
  for (const m of history) {
    const lenErr = lengthError(m?.content, CHAT_MESSAGE_MAX, 'Message');
    if (lenErr) return res.status(400).json({ error: lenErr });
  }
  try {
    const response = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      max_tokens: 2048,
      messages: [
        { role: 'system', content: buildAiSystemPrompt(lang) },
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
    // Quota Groq (limite globale de la clé API, partagée par tous les utilisateurs — distincte
    // du plafond par utilisateur d'aiGenerateLimiter ci-dessus) : un message dédié plutôt que
    // l'erreur générique, pour que l'utilisateur sache qu'il suffit de réessayer un peu plus tard.
    if (error instanceof RateLimitError) {
      return res.status(429).json({ error: 'Trop de demandes IA en ce moment, réessaie dans quelques instants.' });
    }
    console.error('AI generation error:', error);
    res.status(500).json({ error: 'Erreur lors de la génération par IA' });
  }
});

router.post('/api/challenges/bulk-save', async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'Token manquant' });
  const token = authHeader.split(' ')[1];
  const { challenges, seriesName, lang } = req.body;
  if (!challenges || !Array.isArray(challenges) || challenges.length === 0) {
    return res.status(400).json({ error: 'Défis requis' });
  }
  // Langue réelle des titres/descriptions envoyés (interface du créateur au moment de l'appel,
  // voir withTranslatedChallenge) — un plan généré par l'IA en anglais doit pouvoir se retraduire
  // vers le français, pas seulement l'inverse.
  const originalLang = lang === 'en' ? 'en' : 'fr';
  // Aucune série légitime ne dépasse quelques semaines : sans plafond, un body forgé
  // pourrait déclencher des milliers de créations concurrentes en un seul appel.
  if (challenges.length > 50) {
    return res.status(400).json({ error: 'Trop de défis en une seule fois (50 maximum).' });
  }
  // Chaque défi du lot passe par le même garde-fou que la création manuelle (voir POST
  // /api/challenges) — sans ça, ce endpoint (alimenté par un plan généré par IA, donc du texte
  // moins contrôlé) laissait passer un titre/description de n'importe quelle longueur.
  for (const c of challenges) {
    const lenErr = lengthError(c?.title, TITLE_MAX, 'Titre') || lengthError(c?.description, DESCRIPTION_MAX, 'Description');
    if (lenErr) return res.status(400).json({ error: lenErr });
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
          originalLang,
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
