const DEEPL_KEY = process.env.DEEPL_API_KEY;
const DEEPL_URL = DEEPL_KEY?.endsWith(':fx')
  ? 'https://api-free.deepl.com/v2/translate'
  : 'https://api.deepl.com/v2/translate';

// Traduit plusieurs textes en un seul appel DeepL (économise le quota).
// Retourne null en cas d'échec (clé absente, quota dépassé, erreur réseau) —
// l'appelant doit alors se rabattre silencieusement sur le texte source.
export async function translateTexts(texts, targetLang = 'EN') {
  if (!DEEPL_KEY) return null;
  try {
    const res = await fetch(DEEPL_URL, {
      method: 'POST',
      headers: { Authorization: `DeepL-Auth-Key ${DEEPL_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: texts, target_lang: targetLang, source_lang: 'FR' }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.translations.map(t => t.text);
  } catch {
    return null;
  }
}
