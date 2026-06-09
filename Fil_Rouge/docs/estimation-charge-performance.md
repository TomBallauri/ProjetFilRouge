# Estimation de charge et performance — ChallengeHub

## 1. Infrastructure en production

| Composant | Technologie | Hébergeur | Ressources |
|-----------|------------|-----------|------------|
| Frontend | React + Vite (statique) | Vercel | CDN mondial, illimité |
| Backend API | Node.js + Express | Render (Free) | 0.1 vCPU, 512 MB RAM |
| Base de données | PostgreSQL 18 | Render (Free) | 1 Go stockage, 256 MB RAM |

---

## 2. Estimation des utilisateurs simultanés

### Hypothèses de charge

L'application cible principalement des étudiants et jeunes adultes. On distingue trois niveaux de charge :

| Niveau | Utilisateurs simultanés | Contexte |
|--------|------------------------|---------|
| Charge faible (normal) | 1 – 20 | Usage quotidien, hors pics |
| Charge moyenne | 20 – 100 | Pic en soirée, événement communautaire |
| Charge élevée | 100 – 500 | Lancement, viralité ponctuelle |

---

## 3. Capacité actuelle de l'infrastructure

### Backend (Render Free — 0.1 vCPU / 512 MB RAM)

Node.js est monothread mais gère les requêtes de manière asynchrone (non-bloquant).

| Métrique | Estimation |
|---------|------------|
| Requêtes simultanées supportées | ~50 connexions actives |
| Temps de réponse moyen (BDD locale) | 50 – 150 ms |
| Temps de réponse au cold start | 30 – 50 secondes (instance endormie) |
| Mémoire utilisée au repos | ~80 – 120 MB |
| Limite avant dégradation | ~80 req/s |

**Conclusion** : L'instance free est adaptée à une charge faible à moyenne (< 50 utilisateurs simultanés). Au-delà, des erreurs de timeout ou des lenteurs apparaîtraient.

### Frontend (Vercel CDN)

Les fichiers statiques (HTML, CSS, JS) sont distribués via le CDN mondial de Vercel. Aucune limite pratique pour les utilisateurs simultanés côté frontend.

| Métrique | Estimation |
|---------|------------|
| Utilisateurs simultanés | Illimité (CDN) |
| Temps de chargement initial (bundle Vite) | < 1 seconde |
| Taille du bundle JS | ~500 Ko (gzippé) |

### Base de données (PostgreSQL Render Free)

| Métrique | Estimation |
|---------|------------|
| Connexions simultanées max | 20 connexions (limite free tier) |
| Stockage actuel | < 50 Mo |
| Capacité max | 1 Go |
| Temps de requête moyen | 10 – 50 ms (réseau interne Render) |

---

## 4. Goulots d'étranglement identifiés

### 4.1 Cold start du backend
L'instance Render free s'endort après 15 minutes d'inactivité. La première requête après une veille prend 30 à 50 secondes.

**Impact** : Mauvaise expérience utilisateur pour le premier visiteur après une période d'inactivité.

**Solution** : Passage à une instance Render payante (Starter à $7/mois) ou mise en place d'un ping automatique toutes les 10 minutes.

### 4.2 Limite de connexions PostgreSQL
Le plan free Render limite à 20 connexions simultanées. Prisma maintient un pool de connexions — en cas de pic de trafic, des requêtes pourraient être mises en attente.

**Solution** : Configurer Prisma avec un pool limité (`connection_limit=5`) ou utiliser PgBouncer.

### 4.3 Absence de cache
Aucun mécanisme de cache n'est implémenté. Les requêtes fréquentes (classement, liste des défis) sollicitent la BDD à chaque appel.

**Solution** : Ajouter un cache en mémoire (ex: node-cache) sur les routes à forte lecture comme `/api/leaderboard` et `/api/challenges`.

---

## 5. Plan d'évolutivité

| Palier d'utilisateurs | Infrastructure recommandée | Coût estimé |
|-----------------------|---------------------------|-------------|
| 0 – 50 utilisateurs | Configuration actuelle (Render Free + Vercel) | 0 €/mois |
| 50 – 500 utilisateurs | Render Starter (backend) + PostgreSQL Standard | ~15 €/mois |
| 500 – 5 000 utilisateurs | Render Standard + PostgreSQL Pro + CDN images | ~50 €/mois |
| > 5 000 utilisateurs | Load balancer + multiple instances + Redis cache | ~150 €/mois |

---

## 6. Résumé

L'infrastructure actuelle est dimensionnée pour une phase de développement et de démonstration (0 à 50 utilisateurs simultanés). Elle est fonctionnelle pour un projet de formation et peut évoluer progressivement vers une infrastructure de production en augmentant les ressources Render et en ajoutant des couches de cache, sans réécriture du code applicatif.
