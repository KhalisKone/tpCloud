# Projet Cloud — Template MicroScore (Master IA, 2iE)

Template pédagogique du projet fil rouge des ECUE *Projet Cloud* et
*Sécurité & Coûts dans le Cloud*. Le cas d'usage fourni est **MicroScore** :
une application de scoring de crédit en microfinance.

Objectif étudiant : partir de ce template, le lancer en local, remplacer le
cas d'usage par celui du groupe, pousser les images sur Docker Hub puis AWS
ECR, et déployer sur ECS Fargate dans le VPC/IAM construits en séance.

## Démarrage Étudiant

Pré-requis : Docker Desktop, Git, un terminal, un compte GitHub. Pour la suite
du cours : Docker Hub, AWS CLI configuré et accès AWS de votre groupe.

```bash
git clone https://github.com/<votre-org>/<votre-repo>.git
cd <votre-repo>
cp .env.example .env
docker compose up --build
```

Docker Compose lit automatiquement le `.env` à la racine. Avec un autre fichier :
`docker compose --env-file .env up --build`.

Ouvrir ensuite :

- Application : http://localhost:5173, redirige vers `/login` tant que vous n'êtes pas connecté
- API : http://localhost:8000
- Swagger : http://localhost:8000/docs

Test rapide de disponibilité :

```bash
curl http://localhost:8000/health
```

Arrêter la stack :

```bash
docker compose down
```

Réinitialiser la base locale si vous changez les identifiants PostgreSQL :

```bash
docker compose down -v
docker compose up --build
```

Même correction si vous voyez :
`FATAL: password authentication failed for user "app"`.
Cause : le volume PostgreSQL garde le mot de passe du premier lancement.

### Lancer un seul service Docker

Services disponibles : `db`, `backend`, `frontend`.

```bash
docker compose up db                    # PostgreSQL seul
docker compose up --build backend       # backend + dépendances
docker compose up --build frontend      # frontend + dépendances
docker compose up --build -d backend    # en arrière-plan
docker compose up --build --no-deps frontend  # sans dépendances déjà lancées
docker compose logs -f backend
```

Après modification d'une variable `VITE_*`, relancer
`docker compose up --build frontend`.

## Configuration

Le fichier `.env.example` est le modèle à copier en `.env`. Le `.env` local ne
se commit jamais.

Variables à connaître :

| Variable | Utilisation |
|---|---|
| `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` | PostgreSQL dans Docker Compose |
| `GOOGLE_CLIENT_ID` | Backend : vérification du token Google |
| `VITE_GOOGLE_CLIENT_ID` | Frontend : bouton Google Identity Services |
| `JWT_SECRET` | Signature des JWT applicatifs |
| `ADMIN_EMAILS` | Emails autorisés dans `/admin` |
| `MODEL_S3_BUCKET`, `MODEL_S3_KEY` | Chargement du modèle depuis S3 |
| `AWS_REGION` | Région AWS, par défaut `eu-west-1` |

Le fichier `client_secret_*.json` téléchargé depuis Google Cloud ne doit pas
être copié dans le projet. Pour cette app, on utilise seulement le `client_id`
public qu'il contient.

Pour activer Google Login en local :

1. Créer un client OAuth Web dans Google Cloud Console.
2. Dans *Google Auth Platform > Branding*, mettre un nom clair, par exemple
   `2IE-IA-PROJECT-TEMPLATE` ou le nom du projet du groupe. C'est ce nom qui
   s'affiche sur l'écran Google "Sign in to continue to ...".
3. Ajouter `http://localhost:5173` dans *Authorized JavaScript origins*.
4. Ajouter aussi `http://127.0.0.1:5173` si vous ouvrez l'app avec `127.0.0.1`.
5. Ne pas mettre `/login` et ne pas ajouter de slash final : Google attend seulement l'origine.
6. Mettre le même client id dans `GOOGLE_CLIENT_ID` et `VITE_GOOGLE_CLIENT_ID`.
7. Mettre votre email dans `ADMIN_EMAILS`.

Si Google affiche `Error 401: invalid_client` avec `no registered origin`, le
client OAuth utilisé par le frontend n'a pas l'origine locale autorisée. Corriger
les origins dans Google Cloud Console, sauvegarder, attendre une ou deux minutes,
puis recharger la page.

## Architecture

Les schémas AWS et leur explication sont dans [`infra/aws/`](infra/aws/) :

- `architecture.png` : variante de référence, tâches ECS en subnet privé.
- `architecture-budget.png` : variante de TP, sans NAT Gateway, tâches ECS en subnet public protégées par Security Groups.

```
Navigateur
   │
   ▼
frontend React + Vite, servi par nginx (:5173)
   │ /api/*
   ▼
backend FastAPI (:8000)
   ├── /predict : scoring ML, JWT requis, rate-limité
   ├── /auth/google : login Google -> JWT
   ├── /admin/* : stats et historique protégés
   └── PostgreSQL + modèle ML local/S3
```

Services Docker Compose :

| Service | Rôle | Port |
|---|---|---|
| `frontend` | React buildé puis servi par nginx | 5173 |
| `backend` | API FastAPI + inférence ML | 8000 |
| `db` | PostgreSQL 16 | interne |

Deux images sont construites (`frontend`, `backend`). Le troisième service
`db` utilise directement l'image officielle `postgres:16-alpine`.

## Développement Local

Backend, depuis `backend/` :

```bash
uv sync
uv run ruff check .
uv run pytest -q
uv run uvicorn app.main:app --reload
```

Frontend, depuis `frontend/` :

```bash
npm install
npm run build
npm run dev
```

Le backend sans Docker utilise sqlite par défaut. Avec Docker Compose,
`DATABASE_URL` est construit automatiquement vers PostgreSQL. Ne pas ajouter
`DATABASE_URL` dans `.env.example`.

## Modèle ML

Le formulaire MicroScore envoie 7 features :

1. âge
2. situation familiale
3. profession
4. revenu mensuel en milliers de FCFA
5. montant demandé en milliers de FCFA
6. durée en mois
7. historique de crédit

Le backend charge le modèle dans cet ordre :

1. S3 si `MODEL_S3_BUCKET` est défini.
2. Fichier local si `MODEL_PATH` existe.
3. Fallback MicroScore entraîné automatiquement.

Flux à retenir :

1. entraîner le modèle ;
2. créer un bucket S3 privé ;
3. uploader `model.pkl` dans ce bucket ;
4. configurer `MODEL_S3_BUCKET` et `MODEL_S3_KEY` ;
5. lancer le backend ou la task ECS.

Générer un modèle local d'exemple :

```bash
cd backend
uv run python ../scripts/train.py
cd ..
```

Cela crée :

```text
backend/models/model.pkl
```

Créer le bucket S3 privé et uploader le modèle :

```bash
aws s3 mb s3://2ie-<groupe>-models --region eu-west-1
aws s3 cp backend/models/model.pkl s3://2ie-<groupe>-models/model.pkl
```

Ou utiliser le script du template, qui crée le bucket privé si nécessaire et
active Block Public Access :

```bash
MODEL_S3_BUCKET=2ie-<groupe>-models AWS_REGION=eu-west-1 bash scripts/setup-s3-model.sh
```

Puis configurer :

```bash
MODEL_S3_BUCKET=2ie-<groupe>-models
MODEL_S3_KEY=model.pkl
AWS_REGION=eu-west-1
```

En local, on peut utiliser des clés AWS dans `.env` si le compte de TP le
prévoit. Sur ECS, on utilise un rôle IAM attaché à la task, pas de clés en dur.

Important : `scripts/build-images.sh`, `scripts/push-dockerhub.sh` et
`scripts/push-ecr.sh` construisent/poussent des images Docker. Ils ne créent
pas le bucket S3 du modèle. Le bucket S3 se prépare avant ECS avec les commandes
ci-dessus ou avec `scripts/setup-s3-model.sh`.

## Docker Hub

Build local :

```bash
docker build -t <dockerhub-user>/projet-cloud-backend:latest backend
docker build -t <dockerhub-user>/projet-cloud-frontend:latest frontend
```

Version scriptée :

```bash
DOCKERHUB_USERNAME=<dockerhub-user> bash scripts/push-dockerhub.sh
```

Si `DOCKERHUB_TOKEN` est dans `.env`, il doit avoir le droit **Read & Write**.
Un token en lecture seule donne : `access token has insufficient scopes`.

Push :

```bash
docker login
docker push <dockerhub-user>/projet-cloud-backend:latest
docker push <dockerhub-user>/projet-cloud-frontend:latest
```

Pull (récupérer une image déjà publiée, sans la rebuilder) :

```bash
docker pull <dockerhub-user>/projet-cloud-backend:latest
docker pull <dockerhub-user>/projet-cloud-frontend:latest
```

Pour la CI GitHub, configurer dans *Settings > Secrets and variables > Actions* :

| Secret | Valeur |
|---|---|
| `DOCKERHUB_USERNAME` | Login Docker Hub |
| `DOCKERHUB_TOKEN` | Token Docker Hub avec droit Read & Write |

Variables GitHub utiles :

| Variable | Valeur |
|---|---|
| `VITE_GOOGLE_CLIENT_ID` | Client id public Google pour l'image frontend |
| `AWS_REGION` | Région AWS, par exemple `eu-west-1` |

## AWS ECR

Créer les repositories :

```bash
aws ecr create-repository --repository-name projet-cloud-backend --region eu-west-1
aws ecr create-repository --repository-name projet-cloud-frontend --region eu-west-1
```

Login et push :

```bash
AWS_ACCOUNT_ID=<votre-account-id>
AWS_REGION=eu-west-1

aws ecr get-login-password --region $AWS_REGION \
  | docker login --username AWS --password-stdin $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com

docker tag <dockerhub-user>/projet-cloud-backend:latest \
  $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/projet-cloud-backend:latest
docker tag <dockerhub-user>/projet-cloud-frontend:latest \
  $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/projet-cloud-frontend:latest

docker push $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/projet-cloud-backend:latest
docker push $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/projet-cloud-frontend:latest
```

Pull (le même `docker login` ECR doit être actif) :

```bash
docker pull $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/projet-cloud-backend:latest
docker pull $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/projet-cloud-frontend:latest
```

En production, ce `pull` est fait automatiquement par ECS au lancement des
tâches — vous n'avez pas à le taper. La commande ci-dessus sert à vérifier
manuellement qu'une image poussée est bien récupérable.

Version scriptée, avec création des repositories si besoin :

```bash
AWS_ACCOUNT_ID=<votre-account-id> AWS_REGION=eu-west-1 bash scripts/push-ecr.sh
```

Pour activer le push ECR en CI, créer un rôle IAM OIDC pour GitHub Actions et
ajouter le secret GitHub :

| Secret | Valeur |
|---|---|
| `AWS_ROLE_TO_ASSUME` | ARN du rôle IAM assumé par GitHub Actions |

## ECS Fargate

À réutiliser depuis la séance IAM/VPC :

- VPC avec subnets publics et privés.
- Rôle `ecsTaskExecutionRole` pour ECR + CloudWatch Logs.
- Rôle applicatif avec lecture seule sur `s3://2ie-<groupe>-models/model.pkl`.
- Security groups : `alb-sg`, `backend-sg`, `db-sg`.
- RDS PostgreSQL dans subnet privé.
- ALB public vers le service ECS.

Fichiers d'exemple :

- `infra/aws/s3-model-read-policy.example.json`
- `infra/aws/task-definition-backend.example.json`
- `infra/aws/task-definition-frontend.example.json`

Variables d'environnement à mettre dans la task definition backend :

```bash
DATABASE_URL=postgresql://<user>:<password>@<rds-endpoint>:5432/<db>
MODEL_S3_BUCKET=2ie-<groupe>-models
MODEL_S3_KEY=model.pkl
AWS_REGION=eu-west-1
GOOGLE_CLIENT_ID=<client-id-google>
JWT_SECRET=<secret-long-aleatoire>
ADMIN_EMAILS=<email-admin-1>,<email-admin-2>
```

Le frontend en production doit être buildé avec :

```bash
VITE_API_URL=/api
VITE_GOOGLE_CLIENT_ID=<client-id-google>
```

## Vérifications Avant Rendu

```bash
cd backend
uv run ruff check .
uv run pytest -q

cd ../frontend
npm run build

cd ..
docker compose up --build
```

Checklist :

- `http://localhost:5173` redirige vers `/login` si aucun utilisateur n'est connecté.
- Une demande de crédit retourne un score.
- `/login` affiche le bouton Google.
- Un admin connecté voit les statistiques et l'historique.
- Aucun secret n'est commité.

## Structure

```
.
├── backend/                  API FastAPI
├── frontend/                 React + Vite + nginx
├── scripts/train.py          entraînement du modèle MicroScore
├── docs/livrable1/           sécurité, coûts, cartographie des risques
├── docs/livrable2/           rapport final
├── docker-compose.yml
├── .env.example
└── .github/workflows/ci-cd.yml
```

## Règles Non Négociables

- `uv` pour Python, jamais `requirements.txt`.
- `.env` jamais commité.
- Aucun secret en dur dans le code.
- Les fichiers `client_secret*.json` restent hors dépôt.
- Le formulaire de scoring exige une authentification Google.
- `/predict` reste rate-limité.
- Pas de push Git automatique : chaque groupe contrôle ses commits et ses pushs.

Projet pédagogique — Master IA, 2iE.
