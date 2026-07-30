// Extrait le premier nombre d'un titre de défi ("Jour 3: ..." / "Day 3: ...") pour trier les
// défis d'une série dans l'ordre plutôt que par date de création (peu fiable : les défis IA
// d'une série sont créés en lot). Volontairement indépendant de la langue — chercher le mot
// "Jour" ne matchait jamais les titres traduits en anglais ("Day"), donc le tri ne faisait plus
// rien une fois l'app en anglais.
export function seriesDayNumber(title: string): number | null {
  const m = /\d+/.exec(title);
  return m ? Number.parseInt(m[0], 10) : null;
}

// Comparateur prêt à l'emploi pour Array.prototype.sort : trie par numéro de jour au sein d'une
// même série, laisse l'ordre inchangé sinon (comparateur "neutre" plutôt que de mélanger des
// défis de séries différentes entre eux).
export function compareBySeriesDayNumber<T extends { challenge: { title: string; seriesName?: string | null } }>(a: T, b: T): number {
  if (a.challenge.seriesName && a.challenge.seriesName === b.challenge.seriesName) {
    const da = seriesDayNumber(a.challenge.title);
    const db = seriesDayNumber(b.challenge.title);
    if (da !== null && db !== null) return da - db;
  }
  return 0;
}

// Résout le nom de série à afficher selon la langue courante de l'interface, en tenant compte de
// la langue d'origine du NOM DE SÉRIE (déduite par vote majoritaire des `originalLang` de ses
// défis, pas seulement du 1er de la liste — un défi édité individuellement sous une autre langue
// d'interface a son propre originalLang qui diffère alors du reste de la série sans que le nom de
// série lui-même ait changé de langue ; voir la même logique côté backend dans
// computeSeriesOriginalLangs, seriesVote.js). Si la langue cible correspond déjà à cette langue
// d'origine, `seriesName` (déjà dans la bonne langue) est utilisé tel quel via `undefined`
// (SeriesDropdown retombe alors sur `name`) ; sinon on prend la traduction mise en cache dans le
// sens correspondant (seriesNameEn ou seriesNameFr).
export function resolveSeriesDisplayName(seriesChallenges: { seriesNameEn?: string | null; seriesNameFr?: string | null; originalLang?: string }[], uiLang: string): string | undefined {
  const target = uiLang === 'en' ? 'en' : 'fr';
  const enCount = seriesChallenges.filter(c => (c.originalLang ?? 'fr') === 'en').length;
  const original = enCount > seriesChallenges.length - enCount ? 'en' : 'fr';
  if (target === original) return undefined;
  return (target === 'en' ? seriesChallenges[0]?.seriesNameEn : seriesChallenges[0]?.seriesNameFr) ?? undefined;
}
