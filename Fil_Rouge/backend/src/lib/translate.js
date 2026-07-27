const DEEPL_KEY = process.env.DEEPL_API_KEY;
const DEEPL_URL = DEEPL_KEY?.endsWith(':fx')
  ? 'https://api-free.deepl.com/v2/translate'
  : 'https://api.deepl.com/v2/translate';

// Traduit plusieurs textes en un seul appel DeepL (économise le quota).
// Retourne null en cas d'échec (clé absente, quota dépassé, erreur réseau) —
// l'appelant doit alors se rabattre silencieusement sur le texte source. On loggue quand même
// la raison de l'échec (sans jamais logger la clé) : un échec silencieux ici ne provoque aucune
// erreur visible côté client (juste du contenu resté en français), donc sans ce log il n'y a
// aucun moyen de diagnostiquer le problème depuis les logs serveur (ex: clé absente sur
// l'environnement de prod, quota DeepL dépassé...).
export async function translateTexts(texts, targetLang = 'EN', sourceLang = 'FR') {
  if (!DEEPL_KEY) {
    console.error('[translateTexts] DEEPL_API_KEY manquante — traduction ignorée, repli sur le texte source.');
    return null;
  }
  try {
    const res = await fetch(DEEPL_URL, {
      method: 'POST',
      headers: { Authorization: `DeepL-Auth-Key ${DEEPL_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: texts, target_lang: targetLang, source_lang: sourceLang }),
    });
    if (!res.ok) {
      console.error(`[translateTexts] Échec DeepL (HTTP ${res.status}) — repli sur le texte source.`);
      return null;
    }
    const data = await res.json();
    return data.translations.map(t => t.text);
  } catch (error) {
    console.error('[translateTexts] Erreur réseau vers DeepL — repli sur le texte source.', error.message);
    return null;
  }
}
