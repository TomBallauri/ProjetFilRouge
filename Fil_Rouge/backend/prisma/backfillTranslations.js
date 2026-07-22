import 'dotenv/config';
import { prisma } from '../src/lib/prisma.js';
import { withTranslatedChallenge, withTranslatedCosmetic } from '../src/lib/translateContent.js';
import { translateTexts } from '../src/lib/translate.js';

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// Traduit une bonne fois pour toutes le contenu déjà en base (défis + cosmétiques
// seedés) au lieu d'attendre que le premier visiteur anglophone déclenche la
// traduction à la volée. Idempotent : ne retraduit pas ce qui a déjà titleEn/nameEn/seriesNameEn.
// Petite pause entre chaque appel pour ne pas déclencher le rate-limit anti-abus de DeepL.
async function main() {
  const seriesRows = await prisma.challenge.findMany({
    where: { seriesName: { not: null }, seriesNameEn: null },
    select: { seriesName: true },
    distinct: ['seriesName'],
  });
  console.log(`${seriesRows.length} noms de série à traduire...`);
  let seriesCount = 0;
  for (const { seriesName } of seriesRows) {
    const translated = await translateTexts([seriesName]);
    if (translated) {
      await prisma.challenge.updateMany({ where: { seriesName, seriesNameEn: null }, data: { seriesNameEn: translated[0] } });
      seriesCount++;
    }
    await sleep(300);
  }
  console.log(`${seriesCount} noms de série traduits.`);

  const challenges = await prisma.challenge.findMany({ where: { titleEn: null } });
  console.log(`${challenges.length} défis à traduire...`);
  let challengeCount = 0;
  for (const c of challenges) {
    const translated = await withTranslatedChallenge(c, 'en');
    if (translated.title !== c.title) challengeCount++;
    await sleep(300);
  }
  console.log(`${challengeCount} défis traduits.`);

  const cosmetics = await prisma.cosmetic.findMany({ where: { nameEn: null } });
  console.log(`${cosmetics.length} cosmétiques à traduire...`);
  let cosmeticCount = 0;
  for (const c of cosmetics) {
    const translated = await withTranslatedCosmetic(c, 'en');
    if (translated.name !== c.name) cosmeticCount++;
    await sleep(300);
  }
  console.log(`${cosmeticCount} cosmétiques traduits.`);
}

main()
  .catch(e => { console.error(e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
