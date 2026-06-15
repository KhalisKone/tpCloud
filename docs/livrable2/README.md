# Livrable 2 — Application déployée et rapport (ECUE1)

À déposer dans ce dossier avant la soutenance : rapport PDF + URL publique active + démo live le jour J.

## Objectif

Mettre en œuvre le plan défini dans le Livrable 1. Au-delà de "ça marche", il faut documenter les écarts entre ce qui était prévu et ce que vous avez vraiment construit.

## Ce qui est attendu

### 1. Application déployée et accessible

Une URL publique qui sert :

- Un frontend React fonctionnel
- Une API FastAPI avec `/predict` (inférence ML) et `/health`
- Une base PostgreSQL (ou MongoDB) avec des données persistées
- Un modèle ML chargé au démarrage, accessible via l'API
- Le tout conteneurisé avec Docker et Docker Compose

### 2. Pipeline CI/CD

- GitHub Actions : push sur `main` → tests → build → push images → déploiement
- Les scans de sécurité prévus dans le Livrable 1 (trufflehog, pip-audit, Trivy)
- Tous les secrets dans GitHub Secrets, aucun dans le code

### 3. Code propre sur GitHub

Le repo doit contenir au minimum :

- Le code des deux services (`frontend/`, `backend/`)
- `docker-compose.yml`
- Le workflow CI/CD
- Un `README.md` racine qui explique comment lancer le projet
- Les deux dossiers `docs/livrable1/` et `docs/livrable2/` avec leurs rapports

### 4. Rapport technique (7 à 8 pages)

| Section                                          | Pages |
|--------------------------------------------------|-------|
| 1. Contexte et objectif                          | 0,5   |
| 2. Architecture (schéma final, comparaison L1)   | 1     |
| 3. Développement (back, front, BDD, ML)          | 2     |
| 4. Conteneurisation et déploiement               | 1,5   |
| 5. Sécurité (exécution du plan L1, écarts)       | 1     |
| 6. Coûts (réel vs estimé)                        | 0,5   |
| 7. Difficultés et solutions                      | 0,5   |
| 8. Conclusion                                    | 0,5   |

Le rapport cite le Livrable 1 sans le répéter. Il montre l'exécution et les écarts.

Format conseillé pour la section sécurité :

| Mesure prévue (L1)                    | Faite ? | Preuve / explication de l'écart      |
|---------------------------------------|---------|--------------------------------------|
| Secrets en variables d'environnement  | Oui     | Capture GitHub Secrets               |
| Trufflehog en CI                      | Oui     | Capture run CI                       |
| HTTPS en production                   | Oui     | URL publique en `https://`           |
| JWT auth API                          | Non     | Repoussé : priorité au MVP           |

## Soutenance (15 min)

| Durée | Contenu                                                            |
|-------|--------------------------------------------------------------------|
| 5 min | Démo live : naviguer dans l'app, faire une prédiction, montrer la CI |
| 5 min | Architecture et choix techniques                                   |
| 3 min | Écarts plan / réalité                                              |
| 2 min | Questions                                                          |

Démo en direct, pas de vidéo. Prévoyez un plan B : démo locale avec `docker compose up` si le réseau lâche.

## Format de remise

- `rapport-livrable2.pdf` (7-8 pages) dans ce dossier
- Captures en annexe : CI réussie, application déployée, tableau des coûts
- URL publique active le jour de la soutenance
- Repo GitHub avec un historique de commits propre (au moins un commit par membre du groupe)

## Grille d'évaluation

| Critère                                  | Points | Évalué sur                                              |
|------------------------------------------|--------|---------------------------------------------------------|
| Application déployée et fonctionnelle    | 25     | URL accessible, services up, prédiction ML correcte     |
| Architecture et choix techniques         | 15     | Schéma clair, séparation des services, choix justifiés  |
| Docker et reproductibilité               | 15     | Dockerfiles propres, `docker compose up` qui marche     |
| Pipeline CI/CD                           | 15     | Tests + build + push + scans sécurité actifs            |
| Cohérence avec le Livrable 1             | 10     | Mesures du L1 appliquées, écarts documentés             |
| Sécurité implémentée                     | 10     | Secrets protégés, validation entrées, deps saines       |
| Rapport et soutenance                    | 10     | Rapport structuré, démo live réussie                    |
| **Total**                                | **100**|                                                         |

Quatre choses entraînent une pénalité de 20 points :

- Pas d'URL publique et pas de démo locale qui tourne
- Pas de pipeline CI/CD
- Secrets exposés dans le code
- Pas de rapport technique

Et zéro : un projet copié à l'identique d'un autre groupe.
