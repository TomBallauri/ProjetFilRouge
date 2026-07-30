// Langue d'origine d'un nom de série déduite par vote majoritaire des `originalLang` de TOUS ses
// défis, plutôt que du premier défi rencontré (dont l'ordre est arbitraire) : un défi modifié
// individuellement sous une autre langue d'interface (voir PUT /api/challenges/:id) change SON
// originalLang sans que le nom de série lui-même ait changé de langue — sans ce vote, cet unique
// défi pouvait faire échouer/mal orienter la traduction de toute la série selon l'ordre de la liste.
// Utilisée par ensureSeriesNamesTranslated (translateContent.js) ; même logique côté frontend
// dans resolveSeriesDisplayName (ChallengePage.tsx). Extraite sans dépendance Prisma/DeepL pour
// rester testable unitairement.
export function computeSeriesOriginalLangs(challenges) {
  const counts = new Map(); // seriesName -> { fr, en }
  for (const c of challenges) {
    if (!c.seriesName) continue;
    const entry = counts.get(c.seriesName) ?? { fr: 0, en: 0 };
    entry[c.originalLang ?? 'fr']++;
    counts.set(c.seriesName, entry);
  }
  const result = new Map(); // seriesName -> 'fr' | 'en'
  for (const [seriesName, entry] of counts) {
    result.set(seriesName, entry.en > entry.fr ? 'en' : 'fr');
  }
  return result;
}
