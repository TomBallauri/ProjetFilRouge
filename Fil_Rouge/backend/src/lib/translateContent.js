import { prisma } from './prisma.js';
import { translateTexts } from './translate.js';

// DeepL ajoute parfois des guillemets décoratifs autour de noms courts
// (ex. "Cadre Foudre Ardente" → `"Blazing Lightning" Frame`) — indésirable pour
// des noms d'objets/titres/séries courts. On ne l'applique volontairement PAS
// aux descriptions (phrases complètes où des guillemets peuvent être légitimes).
const stripDecorativeQuotes = (text) => text.replace(/["'“”‘’]/g, '').trim();

// Traduit et met en cache (colonnes titleEn/descriptionEn) un défi à la volée.
// Ne fait un appel DeepL que si la traduction n'a jamais été calculée — sinon
// on relit simplement le cache déjà en base.
// `seriesNameEn` (déjà résolu par ensureSeriesNamesTranslated, voir plus bas) est
// ajouté tel quel dans le résultat, SANS jamais écraser `seriesName` — ce dernier
// reste la clé stable (en français) utilisée pour l'URL des endpoints by-series
// et les groupes de série ; seul `seriesNameEn` sert à l'affichage.
export async function withTranslatedChallenge(challenge, lang, seriesNameEn) {
  if (lang !== 'en') return challenge;
  const resolvedSeriesNameEn = challenge.seriesName
    ? (challenge.seriesNameEn ?? seriesNameEn ?? null)
    : null;
  if (challenge.titleEn) {
    return {
      ...challenge,
      title: challenge.titleEn,
      description: challenge.descriptionEn ?? challenge.description,
      seriesNameEn: resolvedSeriesNameEn,
    };
  }
  const translated = await translateTexts([challenge.title, challenge.description]);
  if (!translated) return { ...challenge, seriesNameEn: resolvedSeriesNameEn }; // repli silencieux vers le FR
  const titleEn = stripDecorativeQuotes(translated[0]);
  const descriptionEn = translated[1];
  await prisma.challenge.update({ where: { id: challenge.id }, data: { titleEn, descriptionEn } }).catch(() => {});
  return { ...challenge, title: titleEn, description: descriptionEn, seriesNameEn: resolvedSeriesNameEn };
}

export async function withTranslatedCosmetic(cosmetic, lang) {
  if (lang !== 'en') return cosmetic;
  if (cosmetic.nameEn) {
    return { ...cosmetic, name: cosmetic.nameEn, description: cosmetic.descriptionEn ?? cosmetic.description };
  }
  const translated = await translateTexts([cosmetic.name, cosmetic.description]);
  if (!translated) return cosmetic;
  const nameEn = stripDecorativeQuotes(translated[0]);
  const descriptionEn = translated[1];
  await prisma.cosmetic.update({ where: { id: cosmetic.id }, data: { nameEn, descriptionEn } }).catch(() => {});
  return { ...cosmetic, name: nameEn, description: descriptionEn };
}

// Traduit chaque nom de série UNE seule fois (et non une fois par ligne de défi qui
// le partage) : dédoublonne d'abord, puis propage le résultat à toutes les lignes
// de la série via updateMany — évite de saturer le quota DeepL avec des appels
// redondants pour un texte identique.
async function ensureSeriesNamesTranslated(challenges) {
  const map = new Map(); // seriesName (FR) -> seriesNameEn
  const toTranslate = [...new Set(
    challenges.filter(c => c.seriesName && !c.seriesNameEn).map(c => c.seriesName)
  )];
  await Promise.allSettled(toTranslate.map(async (name) => {
    const translated = await translateTexts([name]);
    if (!translated) return;
    const seriesNameEn = stripDecorativeQuotes(translated[0]);
    map.set(name, seriesNameEn);
    await prisma.challenge.updateMany({ where: { seriesName: name, seriesNameEn: null }, data: { seriesNameEn } }).catch(() => {});
  }));
  return map;
}

// Applique un traducteur item par item sur une liste, sans qu'un échec sur un
// item empêche les autres de s'afficher (Promise.allSettled, pas Promise.all).
async function withTranslatedList(items, translateOne, lang) {
  if (lang !== 'en') return items;
  const results = await Promise.allSettled(items.map(item => translateOne(item, lang)));
  return results.map((r, i) => (r.status === 'fulfilled' ? r.value : items[i]));
}

export async function withTranslatedChallenges(challenges, lang) {
  if (lang !== 'en') return challenges;
  const seriesMap = await ensureSeriesNamesTranslated(challenges);
  const results = await Promise.allSettled(
    challenges.map(c => withTranslatedChallenge(c, lang, seriesMap.get(c.seriesName)))
  );
  return results.map((r, i) => (r.status === 'fulfilled' ? r.value : challenges[i]));
}

export const withTranslatedCosmetics = (cosmetics, lang) => withTranslatedList(cosmetics, withTranslatedCosmetic, lang);

// Variante pour les listes de UserChallenge (le défi est imbriqué sous `.challenge`,
// utilisée par GET /api/users/me/challenges et /api/users/me/profile-data).
export async function withTranslatedUserChallenges(userChallenges, lang) {
  if (lang !== 'en') return userChallenges;
  const rawChallenges = userChallenges.map(uc => uc.challenge);
  const translatedChallenges = await withTranslatedChallenges(rawChallenges, lang);
  return userChallenges.map((uc, i) => ({ ...uc, challenge: translatedChallenges[i] }));
}

// Idem pour les listes de UserCosmetic (le cosmétique est imbriqué sous `.cosmetic`).
export async function withTranslatedUserCosmetics(userCosmetics, lang) {
  if (lang !== 'en') return userCosmetics;
  const rawCosmetics = userCosmetics.map(uc => uc.cosmetic);
  const translatedCosmetics = await withTranslatedCosmetics(rawCosmetics, lang);
  return userCosmetics.map((uc, i) => ({ ...uc, cosmetic: translatedCosmetics[i] }));
}
