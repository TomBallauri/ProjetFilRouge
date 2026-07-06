# U-Quail

Plateforme de gamification qui transforme des objectifs personnels en défis suivis, récompensés et partagés — seul ou en groupe.

## Fonctionnalités

- Authentification (inscription, connexion, mot de passe oublié par email)
- Création et suivi de défis personnels (catégories, difficultés, séries multi-jours)
- Génération de défis personnalisés par IA (Groq)
- Système de récompense : coins, XP, niveaux, streaks quotidiens
- Défis en groupe (groupe sur un défi unique + groupe sur une série) avec tchat en temps réel
- Système d'amis (demandes, acceptation, recherche)
- Boutique de cosmétiques (cadres, bannières, badges, titres) par rareté
- Classement mondial et entre amis
- Tableau de bord administrateur (utilisateurs, défis, cosmétiques)
- Notifications en temps réel (messages, invitations, streak à risque)

## Stack technique

| | |
|---|---|
| Frontend | React, Vite, TypeScript, Tailwind CSS, React Router, Zustand |
| Backend | Node.js, Express, Prisma ORM |
| Base de données | PostgreSQL (Neon) |
| IA | Groq |
| Email | Nodemailer (Gmail SMTP) |
| Déploiement | Vercel (frontend), Render (backend) |

## Installation

```bash
./scripts/setup-dev-environment.sh
```

Ce script installe les dépendances (frontend et backend), applique les migrations Prisma et peuple la base avec les défis et cosmétiques par défaut.

Sinon, manuellement :

```bash
npm install
cd backend && npm install
npx prisma migrate deploy
npm run seed
```

## Variables d'environnement

À définir dans `backend/.env` :

| Variable | Description |
|---|---|
| `DATABASE_URL` | Chaîne de connexion PostgreSQL |
| `JWT_SECRET` | Secret de signature des tokens d'authentification |
| `GROQ_API_KEY` | Clé API Groq (génération de défis par IA) |
| `FRONTEND_URL` | URL du frontend déployé (utilisée dans les liens d'email) |
| `GMAIL_USER` | Adresse Gmail utilisée pour l'envoi d'email |
| `GMAIL_APP_PASSWORD` | Mot de passe d'application Google (pas le mot de passe du compte) |

> Le SMTP sortant est bloqué sur le plan gratuit de Render — une instance payante (Starter) est nécessaire pour que l'envoi d'email fonctionne en production.

## Scripts disponibles

| Commande | Rôle |
|---|---|
| `npm run dev` | Démarre le frontend en local |
| `npm run build` | Build de production du frontend |
| `cd backend && node index.js` | Démarre le backend en local |
| `cd backend && npm run seed` | Peuple la base (défis et cosmétiques par défaut) |
| `./scripts/health-check.sh <url>` | Vérifie qu'un environnement déployé répond correctement |

## Structure du projet

```
Fil_Rouge/
├── src/                  # Frontend React
│   ├── pages/            # Une page par route
│   ├── components/       # Composants réutilisables
│   └── lib/              # Store, politique de mot de passe, utilitaires
├── backend/
│   ├── index.js          # Point d'entrée API (routes Express)
│   ├── services/         # Logique métier (StreakService, RewardCalculator)
│   └── prisma/           # Schéma, migrations, seed
├── scripts/              # Scripts d'installation et de vérification
└── docs/                 # Documentation technique et méthodologique
```

## Déploiement

- **Frontend** : Vercel, déployé automatiquement depuis `main`
- **Backend** : Render, déployé automatiquement depuis `main`
- **Base de données** : Neon (PostgreSQL managé)

## Documentation complémentaire

Le dossier `docs/` contient l'analyse des risques, les procédures utilisateurs, l'architecture, les tests et débogages réalisés, ainsi que la méthodologie de conduite de projet.
