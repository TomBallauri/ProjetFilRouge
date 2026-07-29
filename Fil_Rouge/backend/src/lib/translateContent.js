import { prisma } from './prisma.js';
import { translateTexts } from './translate.js';

// DeepL ajoute parfois des guillemets décoratifs autour de noms courts
// (ex. "Cadre Foudre Ardente" → `"Blazing Lightning" Frame`) — indésirable pour
// des noms d'objets/titres/séries courts. On ne l'applique volontairement PAS
// aux descriptions (phrases complètes où des guillemets peuvent être légitimes).
const stripDecorativeQuotes = (text) => text.replace(/["'“”‘’]/g, '').trim();

// Seules fr/en sont réellement gérées (voir detectBrowserLanguageCode côté frontend) — toute
// autre valeur (ou absence de lang) retombe sur 'fr'.
const targetLangOf = (lang) => (lang === 'en' ? 'en' : 'fr');

// Traduit un défi dans les DEUX sens et met en cache le résultat. `originalLang` (définie à la
// création/dernière édition — voir POST /api/challenges et PUT /api/challenges/:id) indique la
// langue réelle de `title`/`description`, qui n'est PAS toujours le français (ex: un défi créé
// via le générateur IA pendant que l'interface était en anglais). Si la langue demandée est déjà
// `originalLang`, rien à faire ; sinon on traduit vers l'AUTRE langue, mise en cache dans
// titleEn/descriptionEn (si originalLang='fr') ou titleFr/descriptionFr (si originalLang='en') —
// jamais les deux paires à la fois pour un même défi, une seule direction est jamais nécessaire.
// `seriesName` reste la clé stable utilisée pour l'URL des endpoints by-series et les groupes de
// série, quelle que soit sa langue d'origine — seul seriesNameEn/seriesNameFr sert à l'affichage
// (déjà résolu par ensureSeriesNamesTranslated, voir plus bas).
export async function withTranslatedChallenge(challenge, lang, resolvedSeriesName) {
  const target = targetLangOf(lang);
  const original = challenge.originalLang ?? 'fr';
  if (target === original) return challenge;

  const seriesNameKey = target === 'en' ? 'seriesNameEn' : 'seriesNameFr';
  const seriesNameOut = challenge.seriesName ? (challenge[seriesNameKey] ?? resolvedSeriesName ?? null) : null;
  const titleField = target === 'en' ? 'titleEn' : 'titleFr';
  const descField = target === 'en' ? 'descriptionEn' : 'descriptionFr';

  if (challenge[titleField]) {
    return {
      ...challenge,
      title: challenge[titleField],
      description: challenge[descField] ?? challenge.description,
      [seriesNameKey]: seriesNameOut,
    };
  }
  const translated = await translateTexts([challenge.title, challenge.description], target.toUpperCase(), original.toUpperCase());
  if (!translated) return { ...challenge, [seriesNameKey]: seriesNameOut }; // repli silencieux vers le texte source
  const titleTranslated = stripDecorativeQuotes(translated[0]);
  const descTranslated = translated[1];
  await prisma.challenge.update({ where: { id: challenge.id }, data: { [titleField]: titleTranslated, [descField]: descTranslated } }).catch(() => {});
  return { ...challenge, title: titleTranslated, description: descTranslated, [seriesNameKey]: seriesNameOut };
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

// Traduit chaque nom de série UNE seule fois (et non une fois par ligne de défi qui le partage) :
// dédoublonne d'abord, puis propage le résultat à toutes les lignes de la série via updateMany —
// évite de saturer le quota DeepL avec des appels redondants pour un texte identique. Bidirectionnel
// comme withTranslatedChallenge : ignore les séries déjà dans la langue demandée.
async function ensureSeriesNamesTranslated(challenges, lang) {
  const target = targetLangOf(lang);
  const seriesNameKey = target === 'en' ? 'seriesNameEn' : 'seriesNameFr';

  // La langue d'origine du NOM DE SÉRIE est déduite par vote majoritaire des `originalLang` de
  // ses défis, plutôt que du premier défi rencontré dans `challenges` (dont l'ordre est
  // arbitraire) : un défi modifié individuellement sous une autre langue d'interface (voir PUT
  // /api/challenges/:id) change SON originalLang sans que le nom de série ait changé de langue —
  // sans ce vote, cet unique défi pouvait faire échouer la traduction de toute la série selon
  // l'ordre de la liste.
  const langCountsBySeriesName = new Map();
  for (const c of challenges) {
    if (!c.seriesName) continue;
    const counts = langCountsBySeriesName.get(c.seriesName) ?? { fr: 0, en: 0 };
    counts[c.originalLang ?? 'fr']++;
    langCountsBySeriesName.set(c.seriesName, counts);
  }

  const originalBySeriesName = new Map();
  for (const c of challenges) {
    if (!c.seriesName || c[seriesNameKey]) continue;
    const counts = langCountsBySeriesName.get(c.seriesName);
    const original = counts.en > counts.fr ? 'en' : 'fr';
    if (original === target) continue;
    if (!originalBySeriesName.has(c.seriesName)) originalBySeriesName.set(c.seriesName, original);
  }
  const map = new Map(); // seriesName (clé stable) -> nom traduit dans la langue cible
  await Promise.allSettled([...originalBySeriesName.entries()].map(async ([name, original]) => {
    const translated = await translateTexts([name], target.toUpperCase(), original.toUpperCase());
    if (!translated) return;
    const value = stripDecorativeQuotes(translated[0]);
    map.set(name, value);
    await prisma.challenge.updateMany({ where: { seriesName: name, [seriesNameKey]: null }, data: { [seriesNameKey]: value } }).catch(() => {});
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
  const seriesMap = await ensureSeriesNamesTranslated(challenges, lang);
  const results = await Promise.allSettled(
    challenges.map(c => withTranslatedChallenge(c, lang, seriesMap.get(c.seriesName)))
  );
  return results.map((r, i) => (r.status === 'fulfilled' ? r.value : challenges[i]));
}

export const withTranslatedCosmetics = (cosmetics, lang) => withTranslatedList(cosmetics, withTranslatedCosmetic, lang);

// Variante pour les listes de UserChallenge (le défi est imbriqué sous `.challenge`,
// utilisée par GET /api/users/me/challenges et /api/users/me/profile-data).
export async function withTranslatedUserChallenges(userChallenges, lang) {
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
