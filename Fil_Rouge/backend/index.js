import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { prisma } from './src/lib/prisma.js';

import authRoutes from './src/routes/auth.routes.js';
import usersRoutes from './src/routes/users.routes.js';
import uploadsRoutes from './src/routes/uploads.routes.js';
import challengesRoutes from './src/routes/challenges.routes.js';
import cosmeticsRoutes from './src/routes/cosmetics.routes.js';
import seriesGroupsRoutes from './src/routes/seriesGroups.routes.js';
import leaderboardRoutes from './src/routes/leaderboard.routes.js';
import friendsRoutes from './src/routes/friends.routes.js';
import notificationsRoutes from './src/routes/notifications.routes.js';
import groupsRoutes from './src/routes/groups.routes.js';

const app = express();
// Render (et Vercel en amont) mettent l'app derrière un proxy : sans ça, express-rate-limit
// refuse de démarrer dès qu'il voit un header Forwarded/X-Forwarded-For non approuvé, et
// req.ip ne reflète pas la vraie IP du client. On ne fait confiance qu'au premier hop (le
// load balancer de Render), pas à une chaîne arbitraire fournie par le client.
app.set('trust proxy', 1);
// Évite d'annoncer la stack au monde entier — helmet seul ne suffit pas ici, Express
// réécrit l'en-tête après coup si ce réglage n'est pas désactivé au niveau de l'app.
app.disable('x-powered-by');

// Front et back sont toujours joints via un rewrite (Vercel en prod, le proxy Vite en dev) :
// vu du navigateur c'est du same-origin, donc les réglages par défaut (dont
// Cross-Origin-Resource-Policy: same-origin) n'empêchent pas de charger les avatars/bannières.
app.use(helmet());
app.use(cors());
app.use(express.json());
// express.json() laisse req.body à `undefined` (au lieu de `{}`) quand la requête
// n'a pas de Content-Type application/json — ce qui fait planter (500) toute route
// qui déstructure req.body directement, avant même sa validation métier.
app.use((req, res, next) => {
  if (req.body === undefined) req.body = {};
  next();
});

app.use(authRoutes);
app.use(usersRoutes);
app.use(uploadsRoutes);
app.use(challengesRoutes);
app.use(cosmeticsRoutes);
app.use(seriesGroupsRoutes);
app.use(leaderboardRoutes);
app.use(friendsRoutes);
app.use(notificationsRoutes);
app.use(groupsRoutes);

const port = process.env.PORT || 3001;
app.listen(port, () => {
  console.log(`Serveur backend lancé sur http://localhost:${port}`);
  // Create performance indexes in background (idempotent — safe to run on every boot)
  Promise.all([
    prisma.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "Challenge_seriesName_idx" ON "Challenge"("seriesName")'),
    prisma.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "UserChallenge_userId_status_idx" ON "UserChallenge"("userId", "status")'),
    prisma.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "SeriesGroupMember_userId_idx" ON "SeriesGroupMember"("userId")'),
    prisma.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "SeriesGroupMember_groupId_idx" ON "SeriesGroupMember"("groupId")'),
    prisma.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "SeriesGroupMessage_groupId_createdAt_idx" ON "SeriesGroupMessage"("groupId", "createdAt")'),
    prisma.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "ChallengeGroupMember_userId_idx" ON "ChallengeGroupMember"("userId")'),
    prisma.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "GroupMessage_groupId_createdAt_idx" ON "GroupMessage"("groupId", "createdAt")'),
  ]).catch(() => {});
});
