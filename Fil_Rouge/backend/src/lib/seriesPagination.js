// Une série de défis (plusieurs lignes liées par seriesName) compte comme UN seul
// groupe pour la pagination, au même titre qu'un défi solo — sinon "Charger plus"
// peut ne renvoyer que des lignes d'une série déjà entièrement affichée.
//
// Pattern en 2 temps : on calcule d'abord l'ordre des groupes à partir de lignes
// "légères" (peu de colonnes, pas de include coûteux), puis on ne va chercher les
// lignes complètes que pour les groupes réellement affichés sur la page demandée —
// au lieu de charger tout l'ensemble filtré (join + count compris) à chaque appel.

// `lightRows` doit être trié dans l'ordre où les groupes doivent apparaître : le
// premier élément rencontré pour une clé donnée fixe le rang du groupe et sert de
// représentant pour reconstruire la requête de la page (via son seriesName / id).
export function planGroups(lightRows, keyOf) {
  const keys = [];
  const firstRowByKey = new Map();
  for (const row of lightRows) {
    const key = keyOf(row);
    if (!firstRowByKey.has(key)) { firstRowByKey.set(key, row); keys.push(key); }
  }
  return { keys, firstRowByKey };
}

// Découpe la liste de clés (déjà ordonnée) en une page + métadonnées de pagination.
export function paginateKeys(keys, skip, limit) {
  const total = keys.length;
  const pageKeys = keys.slice(skip, skip + limit);
  return { pageKeys, total, hasMore: skip + pageKeys.length < total };
}

// Reconstitue l'ordre exact "groupes dans l'ordre de pageKeys, puis lignes dans leur
// ordre d'origine à l'intérieur d'un groupe" à partir des lignes complètes récupérées
// pour la page (quelques dizaines de lignes typiquement, pas toute la table).
export function orderRowsByKeys(rows, keyOf, pageKeys) {
  const byKey = new Map();
  for (const row of rows) {
    const key = keyOf(row);
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key).push(row);
  }
  return pageKeys.flatMap(key => byKey.get(key) ?? []);
}
