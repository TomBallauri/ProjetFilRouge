import { prisma } from './prisma.js';
import { translateTexts } from './translate.js';

// Traduit et met en cache (colonnes titleEn/descriptionEn) un défi à la volée.
// Ne fait un appel DeepL que si la traduction n'a jamais été calculée — sinon
// on relit simplement le cache déjà en base.
export async function withTranslatedChallenge(challenge, lang) {
  if (lang !== 'en') return challenge;
  if (challenge.titleEn) {
    return { ...challenge, title: challenge.titleEn, description: challenge.descriptionEn ?? challenge.description };
  }
  const translated = await translateTexts([challenge.title, challenge.description]);
  if (!translated) return challenge; // repli silencieux vers le FR (clé absente, quota, erreur réseau)
  const [titleEn, descriptionEn] = translated;
  await prisma.challenge.update({ where: { id: challenge.id }, data: { titleEn, descriptionEn } }).catch(() => {});
  return { ...challenge, title: titleEn, description: descriptionEn };
}

export async function withTranslatedCosmetic(cosmetic, lang) {
  if (lang !== 'en') return cosmetic;
  if (cosmetic.nameEn) {
    return { ...cosmetic, name: cosmetic.nameEn, description: cosmetic.descriptionEn ?? cosmetic.description };
  }
  const translated = await translateTexts([cosmetic.name, cosmetic.description]);
  if (!translated) return cosmetic;
  const [nameEn, descriptionEn] = translated;
  await prisma.cosmetic.update({ where: { id: cosmetic.id }, data: { nameEn, descriptionEn } }).catch(() => {});
  return { ...cosmetic, name: nameEn, description: descriptionEn };
}

// Applique un traducteur item par item sur une liste, sans qu'un échec sur un
// item empêche les autres de s'afficher (Promise.allSettled, pas Promise.all).
async function withTranslatedList(items, translateOne, lang) {
  if (lang !== 'en') return items;
  const results = await Promise.allSettled(items.map(item => translateOne(item, lang)));
  return results.map((r, i) => (r.status === 'fulfilled' ? r.value : items[i]));
}

export const withTranslatedChallenges = (challenges, lang) => withTranslatedList(challenges, withTranslatedChallenge, lang);
export const withTranslatedCosmetics = (cosmetics, lang) => withTranslatedList(cosmetics, withTranslatedCosmetic, lang);
