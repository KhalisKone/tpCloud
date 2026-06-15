# Livrable 1 — Exemple rempli : MicroScore

> Document modèle. Il montre ce qu'on attend d'un Livrable 1, sur le cas
> d'usage de démonstration du template (MicroScore). Votre rapport porte sur
> **votre** projet, dans **votre** domaine. Reprenez la structure, pas le contenu.

**Projet :** MicroScore — scoring de crédit en microfinance
**Groupe :** Groupe 0 (exemple) · **Plateforme :** AWS, région `eu-west-1`
**Date :** mai 2026

---

## 1. Présentation du projet

MicroScore aide les agents de crédit d'une institution de microfinance à
évaluer un dossier de prêt. L'agent saisit les informations d'un demandeur
(revenu, ancienneté, montant demandé, historique). L'application renvoie une
recommandation : crédit plutôt accordé ou plutôt refusé, avec un niveau de
confiance.

Les utilisateurs sont les agents de crédit en agence, qui saisissent les
dossiers. Un espace administrateur, réservé aux responsables, affiche les
statistiques d'activité.

Le modèle est un classifieur binaire entraîné sur des dossiers historiques,
accordés ou refusés. Sept variables d'entrée. Le fichier `model.pkl` fait
quelques kilo-octets : un modèle léger, pas un réseau de neurones lourd.

Le projet tourne sur AWS, région `eu-west-1`. On aurait pu prendre une
plateforme PaaS comme Fly.io, moins chère et plus simple à mettre en route.
Mais elle masquerait justement ce que le cours veut faire pratiquer : IAM, le
VPC, le réseau, le déploiement de conteneurs. Le choix est assumé. On paie en
euros un apprentissage d'infrastructure.

## 2. Schéma d'architecture prévue

L'architecture déployée est la variante budget : les conteneurs tournent dans
des sous-réseaux publics, protégés par des Security Groups, sans NAT Gateway.
La base de données reste en sous-réseau privé.

![Architecture budget de MicroScore](../../infra/aws/architecture-budget.png)

Les flux :

- Le navigateur de l'agent atteint un **Application Load Balancer** public.
- L'ALB route `/api/*` vers le **backend FastAPI**, le reste vers le
  **frontend React** servi par nginx. Deux services ECS Fargate distincts.
- Le backend lit le **modèle ML depuis S3** au démarrage, et lit/écrit dans la
  **base de données**.
- Le bucket S3 du modèle et la base sont **privés** : aucun accès depuis
  Internet.

Ce qui est public : l'ALB uniquement. Ce qui est interne : le modèle, la base,
toute donnée de dossier.

## 3. Analyse de risques

| Risque | Impact | Probabilité | Mesure prévue |
|--------|--------|-------------|---------------|
| Fuite de secrets dans le dépôt Git | Élevé | Moyenne | `.gitignore` + `.env.example` sans vraie valeur ; scan trufflehog en CI |
| Données de dossier exposées (S3 public par erreur) | Élevé | Moyenne | Block Public Access actif, chiffrement S3, bucket privé |
| Accès non autorisé à l'API de scoring | Élevé | Moyenne | Authentification Google + JWT, CORS restreint |
| Vol du modèle par requêtes massives | Moyen | Moyenne | Rate-limit sur `/predict` (20 req/min/IP), authentification requise |
| Injection SQL | Élevé | Faible | ORM SQLAlchemy, validation des entrées avec Pydantic |
| Image Docker vulnérable | Moyen | Élevée | Scan Trivy en CI, image de base figée et mise à jour |
| Coût qui dérape | Moyen | Moyenne | Architecture budget sans NAT, alarme de budget AWS |
| Indisponibilité sur panne d'une zone | Moyen | Faible | Sous-réseaux sur deux zones de disponibilité |

Le risque le plus sérieux pour MicroScore est la confidentialité des dossiers
de crédit. Ce sont des données personnelles et financières. C'est ce qui
justifie de garder S3 et la base de données strictement privés.

## 4. Gestion des accès (IAM)

| Rôle | Pour qui | Permissions | Principe |
|------|----------|-------------|----------|
| Administrateur | Responsable du projet | Accès complet | MFA obligatoire |
| Développeur | Membres du groupe | ECS, ECR, S3, CloudWatch en lecture/écriture limitée | Pas de droit IAM |
| CI/CD | GitHub Actions | Push ECR + déploiement ECS | Identité fédérée OIDC, aucune clé longue durée |
| Rôle d'exécution ECS | Le service ECS | Pull d'image ECR, écriture des logs | Rôle technique standard |
| Rôle applicatif ECS | Le code backend | `s3:GetObject` sur le seul bucket du modèle | Moindre privilège strict |

Pour le rangement des secrets : ceux de la CI, comme le rôle AWS à assumer,
sont dans les GitHub Secrets. Les secrets applicatifs, clé de signature JWT et
URL de base de données, iront dans AWS SSM Parameter Store, injectés dans le
conteneur au démarrage. Aucun secret n'est écrit en clair dans le dépôt.

## 5. Estimation des coûts

Hypothèses : environ 100 utilisateurs par mois, quelques centaines de
prédictions par jour, services allumés en continu, architecture budget.

| Poste | Service | Coût mensuel |
|-------|---------|--------------|
| Backend + frontend | ECS Fargate, 2 tâches | ~27 $ |
| Répartiteur de charge | Application Load Balancer | ~18 $ |
| Base de données | SQLite dans le conteneur | 0 $ |
| Images et stockage | ECR + S3 + CloudWatch Logs | ~2 $ |
| NAT Gateway | Évité (architecture budget) | 0 $ |
| **Total estimé** | | **~47 $/mois** |

L'architecture de référence (conteneurs en sous-réseau privé) ajouterait un NAT
Gateway, soit environ 32 $ de plus par mois — près de 80 $/mois au total. Le
choix de la variante budget économise ce montant, au prix d'une surface
d'exposition réseau plus large, compensée par des Security Groups stricts.

Le poste base de données est à 0 $ parce que MicroScore utilise SQLite. Une
base PostgreSQL gérée (RDS) ajouterait 13 à 15 $/mois, et resterait recommandée
dès que les données doivent persister entre deux déploiements.

Chiffres indicatifs, à recalculer avec l'AWS Pricing Calculator avant la
remise.

## 6. Plan de mise en œuvre

Les mesures de sécurité à appliquer en ECUE1 (Livrable 2) :

- [ ] `.gitignore` complet et `.env.example` sans aucune vraie valeur
- [ ] Scans en CI : trufflehog (secrets), pip-audit (dépendances), Trivy (image)
- [ ] Authentification de l'API : Google OAuth + JWT
- [ ] Rate-limit sur l'endpoint de scoring
- [ ] Block Public Access vérifié sur tous les buckets S3
- [ ] Secrets applicatifs déplacés vers SSM Parameter Store
- [ ] HTTPS devant l'application
- [ ] Alarme de budget AWS configurée à un seuil bas

---

*Rapport modèle — Master IA, 2iE — ECUE2 Sécurité & Coûts dans le Cloud.*
