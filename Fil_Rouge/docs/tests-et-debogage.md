# Tests et débogage — ChallengeHub

## Contexte

Ce document recense les jeux d'essai réalisés sur l'application ChallengeHub, ainsi que les anomalies détectées et corrigées au cours du développement.

---

## 1. Jeux d'essai fonctionnels

### 1.1 Authentification

| # | Scénario | Données d'entrée | Résultat attendu | Résultat obtenu | Statut |
|---|----------|-----------------|------------------|-----------------|--------|
| A1 | Inscription avec des données valides | email: test@test.com, mdp: Test1234! | Compte créé, redirection accueil | Compte créé, token JWT retourné | ✅ |
| A2 | Inscription avec email déjà utilisé | email existant | Message d'erreur "Email déjà pris" | Erreur 400 retournée | ✅ |
| A3 | Connexion avec identifiants corrects | email + mdp valides | Token JWT, redirection accueil | Connexion réussie | ✅ |
| A4 | Connexion avec mauvais mot de passe | mdp incorrect | Message d'erreur "Identifiants incorrects" | Erreur 401 retournée | ✅ |
| A5 | Accès route protégée sans token | Aucun token | Erreur 401 Unauthorized | Refus d'accès confirmé | ✅ |
| A6 | Token expiré (après 1 jour) | Token périmé | Déconnexion automatique | Token invalide, erreur 401 | ✅ |

---

### 1.2 Gestion des défis

| # | Scénario | Données d'entrée | Résultat attendu | Résultat obtenu | Statut |
|---|----------|-----------------|------------------|-----------------|--------|
| D1 | Démarrer un défi disponible | Utilisateur connecté, défi non commencé | Défi ajouté en statut IN_PROGRESS | Entrée créée en base | ✅ |
| D2 | Démarrer un défi déjà commencé | Même défi, même utilisateur | Message "Défi déjà commencé" | Erreur 400 retournée | ✅ |
| D3 | Compléter un défi en cours | Défi IN_PROGRESS | XP et coins crédités, statut COMPLETED | Mise à jour confirmée | ✅ |
| D4 | Compléter un défi non commencé | Défi non démarré | Erreur "Défi non commencé" | Erreur 404 retournée | ✅ |
| D5 | Créer un défi via l'IA | Prompt utilisateur | 3 défis générés par l'API Anthropic | Défis affichés avec description | ✅ |
| D6 | Filtrer les défis par catégorie | Catégorie: GAMING | Uniquement les défis gaming affichés | Filtre fonctionnel | ✅ |

---

### 1.3 Forum et discussions

| # | Scénario | Données d'entrée | Résultat attendu | Résultat obtenu | Statut |
|---|----------|-----------------|------------------|-----------------|--------|
| F1 | Créer un topic | Titre + contenu + jeu + catégorie | Topic créé et visible dans la liste | Topic affiché immédiatement | ✅ |
| F2 | Poster un message dans un topic | Contenu du message | Message ajouté en bas du fil | Message visible | ✅ |
| F3 | Liker un topic | Clic sur le bouton like | Compteur incrémenté | Like enregistré en base | ✅ |
| F4 | Liker un topic déjà liké | Deuxième clic | Unlike — compteur décrémenté | Comportement toggle confirmé | ✅ |
| F5 | Supprimer un topic dont on est l'auteur | Utilisateur = auteur | Topic supprimé | Suppression en cascade (posts inclus) | ✅ |
| F6 | Supprimer un topic dont on n'est pas l'auteur | Utilisateur ≠ auteur | Erreur 403 Forbidden | Accès refusé confirmé | ✅ |

---

### 1.4 Boutique et cosmétiques

| # | Scénario | Données d'entrée | Résultat attendu | Résultat obtenu | Statut |
|---|----------|-----------------|------------------|-----------------|--------|
| C1 | Acheter un cosmétique avec assez de coins | Utilisateur avec 500 coins, cosmétique à 200 | Achat réussi, coins débités | Achat confirmé, solde mis à jour | ✅ |
| C2 | Acheter un cosmétique sans assez de coins | Utilisateur avec 50 coins, cosmétique à 200 | Erreur "Pas assez de coins" | Erreur 400 retournée | ✅ |
| C3 | Acheter un cosmétique déjà possédé | Cosmétique déjà acheté | Erreur "Déjà acheté" | Erreur 400 retournée | ✅ |
| C4 | Équiper un cosmétique possédé | Cosmétique dans l'inventaire | Cosmétique activé sur le profil | Statut equipped mis à jour | ✅ |
| C5 | Équiper plus de 3 badges simultanément | 4ème badge équipé | Erreur "Maximum 3 badges" | Limite respectée | ✅ |

---

### 1.5 Profil utilisateur

| # | Scénario | Données d'entrée | Résultat attendu | Résultat obtenu | Statut |
|---|----------|-----------------|------------------|-----------------|--------|
| P1 | Modifier son pseudo | Nouveau pseudo | Pseudo mis à jour | Modification enregistrée | ✅ |
| P2 | Modifier son mot de passe avec ancien mot de passe correct | Ancien + nouveau mdp | Mot de passe changé | Hash mis à jour en base | ✅ |
| P3 | Modifier son mot de passe avec ancien mot de passe incorrect | Mauvais ancien mdp | Erreur "Mot de passe actuel incorrect" | Erreur 400 retournée | ✅ |
| P4 | Upload d'un avatar | Fichier image < 5 Mo | Avatar mis à jour | URL du fichier stockée | ✅ |
| P5 | Upload d'un fichier trop lourd | Fichier > 5 Mo | Erreur de taille | Rejet par Multer | ✅ |

---

## 2. Anomalies détectées et corrigées

### Anomalie 1 — Token non retourné à l'inscription

**Symptôme** : Après inscription, toutes les requêtes authentifiées envoyaient `Authorization: Bearer null`.

**Cause** : La route `POST /api/auth/register` créait l'utilisateur mais ne retournait pas de token JWT dans la réponse.

**Correction** : Ajout de la génération et du retour du token JWT dans la réponse d'inscription, identique à la route de login.

```js
const token = jwt.sign({ userId: user.id }, SECRET, { expiresIn: '1d' });
res.json({ message: 'Utilisateur créé', token, user });
```

---

### Anomalie 2 — Import @prisma/client côté frontend

**Symptôme** : Erreur `createRoot(...): Target container is not a DOM element` au chargement de l'application React.

**Cause** : Le fichier `src/lib/store.ts` importait `Priority` depuis `@prisma/client`, un package serveur incompatible avec le navigateur.

**Correction** : Remplacement de l'import par un type TypeScript local.

```ts
// Avant
import { Priority } from '@prisma/client';

// Après
type Priority = 'LOW' | 'MEDIUM' | 'HIGH';
```

---

### Anomalie 3 — Migrations SQLite incompatibles avec PostgreSQL

**Symptôme** : Échec du build sur Render avec erreur `syntax error at or near "AUTOINCREMENT"`.

**Cause** : Les anciennes migrations avaient été écrites pour SQLite (syntaxe `AUTOINCREMENT`), non compatible avec PostgreSQL.

**Correction** : Suppression de toutes les anciennes migrations, changement du provider Prisma de `sqlite` à `postgresql`, et génération d'une nouvelle migration propre pour PostgreSQL.

---

### Anomalie 4 — Dépendance Next.js causant une mauvaise détection Vercel

**Symptôme** : Vercel détectait le projet comme une application Next.js et échouait au build.

**Cause** : `next` était listé dans les dépendances du `package.json` backend sans être utilisé.

**Correction** : Suppression de la dépendance `next` du `package.json` et ajout d'un `vercel.json` avec le preset Vite.

---

### Anomalie 5 — Entrées de migrations échouées bloquant le déploiement

**Symptôme** : Erreur Prisma `P3009 - migrate found failed migrations` lors du déploiement Render.

**Cause** : Des tentatives de migration échouées avaient laissé des entrées invalides dans la table `_prisma_migrations` de PostgreSQL.

**Correction** : Nettoyage de la table via `prisma db execute` puis redéploiement.

```sql
DELETE FROM "_prisma_migrations";
```

---

## 3. Couverture des tests

| Domaine | Scénarios testés | Anomalies trouvées | Anomalies corrigées |
|---------|-----------------|-------------------|---------------------|
| Authentification | 6 | 2 | 2 |
| Défis | 6 | 0 | 0 |
| Forum | 6 | 0 | 0 |
| Boutique | 5 | 0 | 0 |
| Profil | 5 | 0 | 0 |
| Déploiement | — | 3 | 3 |
| **Total** | **28** | **5** | **5** |
