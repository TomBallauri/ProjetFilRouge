import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const challenges = [
  // ─── GAMING ───────────────────────────────────────────────────────────────
  { title: "Première victoire", description: "Remporte une partie dans n'importe quel jeu en ligne.", difficulty: "EASY", category: "GAMING", coinReward: 50, xpReward: 100, isDefault: true },
  { title: "Sans mourir", description: "Termine une partie sans mourir une seule fois.", difficulty: "MEDIUM", category: "GAMING", coinReward: 150, xpReward: 300, isDefault: true },
  { title: "MVP de la partie", description: "Termine une partie en étant le joueur le plus utile (MVP).", difficulty: "MEDIUM", category: "GAMING", coinReward: 150, xpReward: 300, isDefault: true },
  { title: "Série de 5 victoires", description: "Enchaîne 5 victoires consécutives dans un même jeu.", difficulty: "HARD", category: "GAMING", coinReward: 350, xpReward: 700, isDefault: true },
  { title: "Montée de rang", description: "Monte d'un rang dans un jeu compétitif à classement.", difficulty: "HARD", category: "GAMING", coinReward: 350, xpReward: 700, isDefault: true },
  { title: "Headshot only", description: "Termine une partie entière de FPS en ne faisant que des headshots.", difficulty: "EXPERT", category: "GAMING", coinReward: 700, xpReward: 1500, isDefault: true },
  { title: "Champion Valorant", description: "Atteins le rang Platinum sur Valorant.", difficulty: "EXPERT", category: "GAMING", coinReward: 700, xpReward: 1500, isDefault: true },
  { title: "Speedrun débutant", description: "Termine un jeu en moins de 2 heures.", difficulty: "MEDIUM", category: "GAMING", coinReward: 150, xpReward: 300, isDefault: true },
  { title: "Solo vs Squad", description: "Gagne une partie en Battle Royale seul contre des équipes.", difficulty: "EXPERT", category: "GAMING", coinReward: 700, xpReward: 1500, isDefault: true },
  { title: "Assist king", description: "Réalise 10 assists dans une seule partie.", difficulty: "EASY", category: "GAMING", coinReward: 50, xpReward: 100, isDefault: true },
  { title: "100 kills en multijoueur", description: "Atteins 100 éliminations au total dans des parties multijoueur.", difficulty: "EASY", category: "GAMING", coinReward: 50, xpReward: 100, isDefault: true },
  { title: "Clutch 1v5", description: "Gagne une situation 1 contre 5 dans un jeu compétitif.", difficulty: "EXPERT", category: "GAMING", coinReward: 700, xpReward: 1500, isDefault: true },

  // ─── SPORT ────────────────────────────────────────────────────────────────
  { title: "Première sortie", description: "Fais une activité sportive de 30 minutes.", difficulty: "EASY", category: "SPORT", coinReward: 50, xpReward: 100, isDefault: true },
  { title: "Course de 5km", description: "Cours 5 kilomètres sans t'arrêter.", difficulty: "MEDIUM", category: "SPORT", coinReward: 150, xpReward: 300, isDefault: true },
  { title: "Course de 10km", description: "Cours 10 kilomètres en moins d'une heure.", difficulty: "HARD", category: "SPORT", coinReward: 350, xpReward: 700, isDefault: true },
  { title: "Semi-marathon", description: "Termine un semi-marathon (21km).", difficulty: "EXPERT", category: "SPORT", coinReward: 700, xpReward: 1500, isDefault: true },
  { title: "100 pompes", description: "Fais 100 pompes en une seule séance.", difficulty: "HARD", category: "SPORT", coinReward: 350, xpReward: 700, isDefault: true },
  { title: "30 jours de sport", description: "Pratique une activité sportive chaque jour pendant 30 jours.", difficulty: "EXPERT", category: "SPORT", coinReward: 700, xpReward: 1500, isDefault: true },
  { title: "Planche 2 minutes", description: "Tiens la position de planche pendant 2 minutes sans t'arrêter.", difficulty: "MEDIUM", category: "SPORT", coinReward: 150, xpReward: 300, isDefault: true },
  { title: "Nage 1km", description: "Nage 1 kilomètre à la piscine sans t'arrêter.", difficulty: "MEDIUM", category: "SPORT", coinReward: 150, xpReward: 300, isDefault: true },
  { title: "Match de foot amical", description: "Joue et termine un match de football à 11.", difficulty: "EASY", category: "SPORT", coinReward: 50, xpReward: 100, isDefault: true },
  { title: "Yoga quotidien", description: "Pratique le yoga 15 minutes par jour pendant 7 jours.", difficulty: "EASY", category: "SPORT", coinReward: 50, xpReward: 100, isDefault: true },

  // ─── CUISINE ──────────────────────────────────────────────────────────────
  { title: "Ma première recette", description: "Prépare un plat complet en suivant une recette pour la première fois.", difficulty: "EASY", category: "CUISINE", coinReward: 50, xpReward: 100, isDefault: true },
  { title: "Gâteau maison", description: "Cuisine un gâteau entièrement fait maison sans mélange tout préparé.", difficulty: "EASY", category: "CUISINE", coinReward: 50, xpReward: 100, isDefault: true },
  { title: "Pain artisanal", description: "Fais ton propre pain avec levure, farine et eau.", difficulty: "MEDIUM", category: "CUISINE", coinReward: 150, xpReward: 300, isDefault: true },
  { title: "Repas 3 plats", description: "Prépare un repas complet : entrée, plat et dessert pour au moins 2 personnes.", difficulty: "MEDIUM", category: "CUISINE", coinReward: 150, xpReward: 300, isDefault: true },
  { title: "Cuisine d'un autre pays", description: "Prépare un plat traditionnel d'un pays que tu n'as jamais cuisiné.", difficulty: "MEDIUM", category: "CUISINE", coinReward: 150, xpReward: 300, isDefault: true },
  { title: "Pâtes fraîches maison", description: "Fais des pâtes fraîches entièrement à la main.", difficulty: "HARD", category: "CUISINE", coinReward: 350, xpReward: 700, isDefault: true },
  { title: "Sushis maison", description: "Prépare des sushis et makis maison avec du riz à sushi.", difficulty: "HARD", category: "CUISINE", coinReward: 350, xpReward: 700, isDefault: true },
  { title: "Pièce montée", description: "Réalise une pièce montée (choux à la crème empilés) pour un événement.", difficulty: "EXPERT", category: "CUISINE", coinReward: 700, xpReward: 1500, isDefault: true },
  { title: "Semaine végane", description: "Mange 100% végane pendant 7 jours en cuisinant toi-même.", difficulty: "HARD", category: "CUISINE", coinReward: 350, xpReward: 700, isDefault: true },
  { title: "Croissants maison", description: "Réalise des croissants feuilletés entièrement faits maison.", difficulty: "EXPERT", category: "CUISINE", coinReward: 700, xpReward: 1500, isDefault: true },

  // ─── FITNESS ──────────────────────────────────────────────────────────────
  { title: "10 000 pas par jour", description: "Atteins 10 000 pas en une seule journée.", difficulty: "EASY", category: "FITNESS", coinReward: 50, xpReward: 100, isDefault: true },
  { title: "Séance HIIT", description: "Complète une séance HIIT de 20 minutes.", difficulty: "EASY", category: "FITNESS", coinReward: 50, xpReward: 100, isDefault: true },
  { title: "200 squats", description: "Fais 200 squats en une seule session.", difficulty: "MEDIUM", category: "FITNESS", coinReward: 150, xpReward: 300, isDefault: true },
  { title: "Muscle-up", description: "Réussis un muscle-up à la barre fixe.", difficulty: "HARD", category: "FITNESS", coinReward: 350, xpReward: 700, isDefault: true },
  { title: "Handstand", description: "Tiens un équilibre sur les mains pendant 10 secondes.", difficulty: "HARD", category: "FITNESS", coinReward: 350, xpReward: 700, isDefault: true },
  { title: "Front lever", description: "Réussis un front lever tenu 3 secondes.", difficulty: "EXPERT", category: "FITNESS", coinReward: 700, xpReward: 1500, isDefault: true },
  { title: "Challenge 30 jours abdos", description: "Suis un programme de 30 jours d'abdominaux quotidiens.", difficulty: "MEDIUM", category: "FITNESS", coinReward: 150, xpReward: 300, isDefault: true },

  // ─── CRÉATIVITÉ ───────────────────────────────────────────────────────────
  { title: "Croquis du jour", description: "Dessine quelque chose que tu vois autour de toi.", difficulty: "EASY", category: "CREATIVITY", coinReward: 50, xpReward: 100, isDefault: true },
  { title: "Portrait réaliste", description: "Dessine un portrait réaliste d'une personne.", difficulty: "MEDIUM", category: "CREATIVITY", coinReward: 150, xpReward: 300, isDefault: true },
  { title: "Composition musicale", description: "Compose une mélodie originale d'au moins une minute.", difficulty: "MEDIUM", category: "CREATIVITY", coinReward: 150, xpReward: 300, isDefault: true },
  { title: "Court-métrage", description: "Tourne et monte un court-métrage de 2 minutes.", difficulty: "HARD", category: "CREATIVITY", coinReward: 350, xpReward: 700, isDefault: true },
  { title: "Peinture abstraite", description: "Réalise une peinture abstraite avec au moins 5 couleurs.", difficulty: "EASY", category: "CREATIVITY", coinReward: 50, xpReward: 100, isDefault: true },
  { title: "Sculpture d'argile", description: "Crée une sculpture en argile représentant un animal.", difficulty: "MEDIUM", category: "CREATIVITY", coinReward: 150, xpReward: 300, isDefault: true },
  { title: "Illustration numérique", description: "Réalise une illustration numérique complète avec un logiciel.", difficulty: "HARD", category: "CREATIVITY", coinReward: 350, xpReward: 700, isDefault: true },

  // ─── CONNAISSANCE ─────────────────────────────────────────────────────────
  { title: "Lire un livre", description: "Lis et termine un livre (minimum 150 pages).", difficulty: "EASY", category: "KNOWLEDGE", coinReward: 50, xpReward: 100, isDefault: true },
  { title: "Apprendre 50 mots", description: "Apprends 50 mots dans une langue étrangère que tu ne parles pas.", difficulty: "EASY", category: "KNOWLEDGE", coinReward: 50, xpReward: 100, isDefault: true },
  { title: "Quiz sans erreur", description: "Complète un quiz de 20 questions sur un sujet qui t'intéresse sans aucune erreur.", difficulty: "MEDIUM", category: "KNOWLEDGE", coinReward: 150, xpReward: 300, isDefault: true },
  { title: "Apprendre à coder", description: "Complète un tutoriel de programmation et produis un mini-projet fonctionnel.", difficulty: "MEDIUM", category: "KNOWLEDGE", coinReward: 150, xpReward: 300, isDefault: true },
  { title: "Certification en ligne", description: "Complète et obtiens un certificat d'une formation en ligne.", difficulty: "HARD", category: "KNOWLEDGE", coinReward: 350, xpReward: 700, isDefault: true },
  { title: "Apprendre une langue B1", description: "Atteins le niveau B1 dans une langue étrangère.", difficulty: "EXPERT", category: "KNOWLEDGE", coinReward: 700, xpReward: 1500, isDefault: true },
  { title: "Résoudre un Rubik's Cube", description: "Apprends à résoudre un Rubik's Cube 3x3 et réussis-le.", difficulty: "MEDIUM", category: "KNOWLEDGE", coinReward: 150, xpReward: 300, isDefault: true },

  // ─── SOCIAL ───────────────────────────────────────────────────────────────
  { title: "Parler à un inconnu", description: "Engage la conversation avec un(e) inconnu(e) et fais connaissance.", difficulty: "EASY", category: "SOCIAL", coinReward: 50, xpReward: 100, isDefault: true },
  { title: "Organiser un événement", description: "Organise une sortie ou un événement pour au moins 5 personnes.", difficulty: "MEDIUM", category: "SOCIAL", coinReward: 150, xpReward: 300, isDefault: true },
  { title: "Bénévolat", description: "Fais au moins 4 heures de bénévolat dans une association.", difficulty: "MEDIUM", category: "SOCIAL", coinReward: 150, xpReward: 300, isDefault: true },
  { title: "Défi sans téléphone", description: "Passe une journée entière sans regarder ton téléphone.", difficulty: "HARD", category: "SOCIAL", coinReward: 350, xpReward: 700, isDefault: true },
  { title: "Contacter une vieille connaissance", description: "Reprends contact avec quelqu'un que tu n'as pas vu depuis plus d'un an.", difficulty: "EASY", category: "SOCIAL", coinReward: 50, xpReward: 100, isDefault: true },
];

const cosmetics = [
  // Cadres d'avatar COMMON
  { name: "Cadre Argent", description: "Un élégant cadre argenté pour ton avatar.", type: "AVATAR_FRAME", imageUrl: null, price: 100, rarity: "COMMON" },
  { name: "Cadre Or", description: "Un cadre doré qui brille de mille feux.", type: "AVATAR_FRAME", imageUrl: null, price: 250, rarity: "RARE" },
  { name: "Cadre Diamant", description: "Le cadre le plus rare, en diamant étincelant.", type: "AVATAR_FRAME", imageUrl: null, price: 600, rarity: "EPIC" },
  { name: "Cadre Légendaire", description: "Un cadre animé aux flammes violettes pour les vrais champions.", type: "AVATAR_FRAME", imageUrl: "/Legandary_frame.png", price: 1200, rarity: "LEGENDARY" },

  // Titres
  { name: "Titre : Débutant", description: "Affiche fièrement ton titre de débutant.", type: "TITLE", imageUrl: null, price: 50, rarity: "COMMON" },
  { name: "Titre : Challenger", description: "Pour ceux qui aiment les défis.", type: "TITLE", imageUrl: null, price: 200, rarity: "RARE" },
  { name: "Titre : Légende", description: "Un titre réservé aux meilleurs joueurs.", type: "TITLE", imageUrl: null, price: 500, rarity: "EPIC" },
  { name: "Titre : Dieu du Défi", description: "Le titre ultime pour les champions de la plateforme.", type: "TITLE", imageUrl: null, price: 1000, rarity: "LEGENDARY" },

  // Badges
  { name: "Badge Gaming", description: "Montre ta passion pour les jeux vidéo.", type: "BADGE", imageUrl: null, price: 75, rarity: "COMMON" },
  { name: "Badge Sport", description: "Pour les athlètes de la plateforme.", type: "BADGE", imageUrl: null, price: 75, rarity: "COMMON" },
  { name: "Badge Cuisine", description: "Pour les chefs en devenir.", type: "BADGE", imageUrl: null, price: 75, rarity: "COMMON" },
  { name: "Badge Créatif", description: "Pour les artistes et créatifs de la plateforme.", type: "BADGE", imageUrl: null, price: 75, rarity: "COMMON" },
  { name: "Badge Élite", description: "Réservé aux joueurs d'exception.", type: "BADGE", imageUrl: null, price: 400, rarity: "EPIC" },
  { name: "Badge Mythique", description: "Le badge le plus convoité de la plateforme.", type: "BADGE", imageUrl: null, price: 900, rarity: "LEGENDARY" },

  // Banners
  { name: "Bannière Bleue", description: "Une bannière de profil bleue élégante.", type: "BANNER", imageUrl: null, price: 150, rarity: "COMMON" },
  { name: "Bannière Galaxie", description: "Une bannière représentant une galaxie étoilée.", type: "BANNER", imageUrl: null, price: 350, rarity: "RARE" },
  { name: "Bannière Feu", description: "Une bannière enflammée pour les esprits ardents.", type: "BANNER", imageUrl: null, price: 700, rarity: "EPIC" },
  { name: "Bannière Ultime", description: "La bannière absolue des maîtres de la plateforme.", type: "BANNER", imageUrl: null, price: 1500, rarity: "LEGENDARY" },
];

async function main() {
  console.log('Seeding challenges...');
  let challengeCount = 0;
  for (const c of challenges) {
    const existing = await prisma.challenge.findFirst({ where: { title: c.title, isDefault: true } });
    if (!existing) {
      await prisma.challenge.create({ data: c });
      challengeCount++;
    }
  }
  console.log(`${challengeCount} défis créés.`);

  console.log('Seeding cosmetics...');
  let cosmeticCount = 0;
  for (const c of cosmetics) {
    const existing = await prisma.cosmetic.findFirst({ where: { name: c.name } });
    if (!existing) {
      await prisma.cosmetic.create({ data: c });
      cosmeticCount++;
    }
  }
  console.log(`${cosmeticCount} cosmétiques créés.`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
