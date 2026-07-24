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
