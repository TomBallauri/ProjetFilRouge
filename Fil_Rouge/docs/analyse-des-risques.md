# Analyse des risques — ChallengeHub

## Contexte

ChallengeHub est une application web full-stack permettant à des utilisateurs de rejoindre des défis, interagir via un forum, acheter des cosmétiques et consulter un classement. Elle repose sur un frontend React (Vite) déployé sur Vercel et un backend Node.js/Express avec une base PostgreSQL déployée sur Render.

---

## Matrice des risques

### Légende
- **Probabilité** : Faible / Moyenne / Élevée
- **Impact** : Faible / Moyen / Élevé / Critique
- **Criticité** : Probabilité × Impact

---

## 1. Risques de sécurité

| # | Risque | Probabilité | Impact | Criticité | Mesure de prévention |
|---|--------|-------------|--------|-----------|----------------------|
| S1 | Injection SQL | Faible | Critique | Élevée | Prisma ORM utilise des requêtes préparées — aucune concaténation SQL manuelle |
| S2 | Vol de token JWT | Moyenne | Élevé | Élevée | Token stocké en localStorage, expiration à 1 jour, secret JWT en variable d'environnement |
| S3 | Accès non autorisé aux routes protégées | Faible | Élevé | Moyenne | Middleware de vérification JWT sur toutes les routes sensibles (profil, défis, achat) |
| S4 | Exposition de mots de passe | Faible | Critique | Élevée | Hashage bcrypt avec sel (10 rounds) — aucun mot de passe stocké en clair |
| S5 | Upload de fichiers malveillants | Moyenne | Élevé | Élevée | Multer limite la taille des fichiers à 5 Mo — extension non filtrée (amélioration possible) |
| S6 | Cross-Site Scripting (XSS) | Faible | Moyen | Faible | React échappe automatiquement les données dans le JSX |
| S7 | Exposition des variables d'environnement | Faible | Critique | Élevée | `.env` exclu du versioning Git (`.gitignore`), variables configurées dans Render et Vercel |

---

## 2. Risques techniques

| # | Risque | Probabilité | Impact | Criticité | Mesure de prévention |
|---|--------|-------------|--------|-----------|----------------------|
| T1 | Panne du serveur backend (Render) | Moyenne | Élevé | Élevée | Instance free tier — redémarrage automatique, monitoring possible via Render dashboard |
| T2 | Corruption ou perte de données PostgreSQL | Faible | Critique | Élevée | Render effectue des sauvegardes automatiques quotidiennes |
| T3 | Indisponibilité de l'API Anthropic (IA) | Moyenne | Moyen | Moyenne | La fonctionnalité IA est non bloquante — l'appli reste utilisable sans elle |
| T4 | Régression lors d'une mise à jour | Moyenne | Moyen | Moyenne | Déploiement continu via GitHub → Vercel/Render avec historique des commits |
| T5 | Migration de base de données échouée | Faible | Critique | Élevée | `prisma migrate deploy` exécuté en build — rollback possible via historique des migrations |
| T6 | Incompatibilité navigateur | Faible | Moyen | Faible | Vite cible ES2015+, compatibilité assurée pour les navigateurs modernes |

---

## 3. Risques de performance

| # | Risque | Probabilité | Impact | Criticité | Mesure de prévention |
|---|--------|-------------|--------|-----------|----------------------|
| P1 | Surcharge du serveur backend | Moyenne | Élevé | Élevée | Instance Render free (0.1 CPU, 512 MB RAM) — upgrade vers instance payante si trafic croît |
| P2 | Latence élevée base de données | Moyenne | Moyen | Moyenne | Backend et BDD co-localisés sur Render Oregon — latence interne minimale |
| P3 | Cold start Render (instance endormie) | Élevée | Moyen | Élevée | Instance free se met en veille après 15 min d'inactivité — premier appel prend 30-50s |
| P4 | Volume excessif de requêtes API | Faible | Moyen | Faible | Aucun rate-limiting implémenté — à ajouter en production (ex: express-rate-limit) |

---

## 4. Risques RGPD / données personnelles

| # | Risque | Probabilité | Impact | Criticité | Mesure de prévention |
|---|--------|-------------|--------|-----------|----------------------|
| R1 | Stockage de données personnelles non sécurisé | Faible | Élevé | Moyenne | Données chiffrées en transit (HTTPS), mots de passe hashés, BDD sur infrastructure sécurisée |
| R2 | Absence de politique de suppression des données | Moyenne | Moyen | Moyenne | Route `DELETE /api/users/:id` implémentée pour suppression de compte |
| R3 | Accès tiers aux données | Faible | Élevé | Moyenne | Seul Render (hébergeur) a accès aux données — politique de confidentialité à rédiger |

---

## Synthèse

| Niveau de criticité | Nombre de risques |
|---------------------|-------------------|
| Critique | 2 (S4, T5) |
| Élevée | 8 |
| Moyenne | 5 |
| Faible | 3 |

**Les risques les plus prioritaires à traiter en production :**
1. Filtrage des types de fichiers uploadés (S5)
2. Ajout d'un rate-limiting sur l'API (P4)
3. Migration vers une instance Render payante pour supprimer le cold start (P3)
4. Rédaction d'une politique de confidentialité conforme RGPD (R3)
