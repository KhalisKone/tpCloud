# Livrable 1 — Plan de sécurité et budget (ECUE2)

À déposer dans ce dossier avant la fin de l'ECUE2, au format PDF (plus les fichiers source si vous voulez).

## Objectif

Avant de coder, vous planifiez deux choses :

1. Comment votre application sera sécurisée (analyse de risques, mesures concrètes).
2. Combien elle va coûter (estimation détaillée).

Ce livrable est le plan. Vous l'exécutez ensuite en ECUE1 (Livrable 2) et vous comparez plan vs réalité à la fin.

Un exemple rempli est fourni : [`exemple-livrable1-microscore.md`](exemple-livrable1-microscore.md). Il porte sur le cas de démonstration du template. Reprenez sa structure, pas son contenu : votre rapport parle de votre projet.

## Ce que doit contenir le rapport

### 1. Présentation du projet (~0,5 page)

- Le problème résolu, les utilisateurs visés
- Le modèle ML envisagé : type, taille approximative, données
- La plateforme cloud pressentie (AWS, Fly.io, Railway, etc.) et pourquoi

### 2. Schéma d'architecture prévue (~0,5 page)

Un schéma lisible avec :

- Les services (frontend, backend, base de données, stockage objet si pertinent)
- Les flux entre services
- Ce qui est public vs interne

Outils : Excalidraw, draw.io, Mermaid.

### 3. Analyse de risques (1 à 1,5 page)

Format conseillé :

| Risque                               | Impact | Probabilité | Mesure prévue                          |
|--------------------------------------|--------|-------------|----------------------------------------|
| Fuite de secrets dans le repo        | Élevé  | Moyenne     | `.gitignore` + trufflehog en CI        |
| Injection SQL                        | Élevé  | Faible      | ORM SQLAlchemy + validation Pydantic   |
| Accès non autorisé à l'API           | Élevé  | Moyenne     | JWT, rate-limit, CORS restrictif       |
| Image Docker vulnérable              | Moyen  | Élevée      | Scan Trivy en CI, base image à jour    |
| Coût qui dérape                      | Moyen  | Moyenne     | Alarme de budget + cap auto-scaling    |

Visez au moins 6 risques, adaptés à votre cas.

### 4. Gestion des accès (IAM) (~0,5 page)

- Liste des rôles (admin, dev, CI)
- Permissions par rôle, en appliquant le moindre privilège
- Où sont stockés les secrets : GitHub Secrets, AWS Secrets Manager, etc.

### 5. Estimation des coûts (~1 page)

Format conseillé, pour une cible de ~100 utilisateurs/mois :

| Poste                | Service                  | Coût mensuel |
|----------------------|--------------------------|--------------|
| Compute (backend)    | Fly.io shared-cpu-1x     | 3 $          |
| Base de données      | Fly Postgres 1 GB        | 2 $          |
| Stockage modèle ML   | S3 ou volume             | 0,5 $        |
| Domaine + TLS        | Let's Encrypt            | 0 $          |
| Bande passante       | Inclus free tier         | 0 $          |
| **Total**            |                          | **~5,5 $**   |

Indiquez vos hypothèses : nombre de requêtes/jour, taille des données, etc. Sans hypothèses, le chiffre ne veut rien dire.

### 6. Plan de mise en œuvre (~0,5 page)

Une checklist des mesures de sécurité que vous appliquerez en ECUE1 :

- [ ] `.gitignore` + `.env.example`
- [ ] Scans CI : trufflehog, pip-audit, Trivy
- [ ] HTTPS en prod
- [ ] Authentification API
- [ ] Alarme de budget cloud

## Format de remise

- `rapport-livrable1.pdf` (4 à 6 pages hors annexes)
- En option : le schéma au format source (`.excalidraw`, `.drawio`, `.mmd`) dans ce dossier
- Référencez le rapport depuis le `README.md` racine du repo

## Grille d'évaluation

| Critère                                     | Points |
|---------------------------------------------|--------|
| Clarté du schéma d'architecture             | 15     |
| Analyse de risques : couverture + pertinence| 25     |
| Gestion IAM cohérente                       | 15     |
| Estimation budget réaliste et justifiée     | 20     |
| Qualité rédactionnelle                      | 10     |
| Cohérence d'ensemble                        | 15     |
| **Total**                                   | **100**|
