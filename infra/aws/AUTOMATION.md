# Automatisation du déploiement ECS

Ce projet utilise le pattern **`APPVAR_*`** : toutes les variables d'application
sont configurées dans **GitHub** (Settings → Secrets and variables → Actions),
préfixées par `APPVAR_`. Le workflow `deploy-ecs.yml` les détecte, **strippe le
préfixe** et les injecte dans le conteneur ECS via une nouvelle révision de
task definition.

Aucune valeur sensible n'est commitée dans le repo. La task definition n'est
pas commitée non plus : elle est **patchée dynamiquement à chaque déploiement**.

## Quand vous forkez ce template

Les workflows déploient sur une infra qui doit **déjà exister**. Ils ne la
créent pas. L'ordre est donc :

1. Faire le TP manuel : créer le VPC, l'ALB, les target groups, le cluster
   ECS, les deux services, les dépôts ECR, le rôle OIDC. C'est le travail des
   séances précédentes.
2. Créer le rôle IAM de confiance OIDC et mettre son ARN dans le secret
   `AWS_ROLE_TO_ASSUME`.
3. Créer les Variables et Secrets `APPVAR_*` (voir plus bas).
4. Si vous avez nommé votre cluster ou vos services autrement que le template,
   créer les Variables `ECS_CLUSTER`, `ECS_BACKEND_SERVICE`,
   `ECS_FRONTEND_SERVICE`. Sinon, les défauts suffisent.
5. Pousser sur `main` : `ci-cd.yml` build et pousse les images vers ECR.
6. Lancer le pré-vol : `bash scripts/preflight.sh`. Il vérifie en lecture seule
   que tout est en place (cluster, services, target groups, subnets publics,
   Security Groups, image, modèle S3) et liste précisément ce qui manque.
7. Quand le pré-vol est vert, lancer `Deploy to ECS` depuis l'onglet Actions.

Le piège le plus fréquent : lancer `Deploy to ECS` sans avoir d'abord créé le
cluster et les services, ou avec des noms qui ne correspondent pas. Le workflow
échoue alors sur `ServiceNotFoundException`. Le pré-vol attrape ce cas (et une
dizaine d'autres) avant que vous ne lanciez le déploiement.

Si vous avez nommé votre cluster autrement, passez-le aussi au pré-vol :

```bash
ECS_CLUSTER=mon-cluster \
ECS_BACKEND_SERVICE=mon-backend \
ECS_FRONTEND_SERVICE=mon-frontend \
bash scripts/preflight.sh
```

## Comment ça marche

```
GitHub Settings                              AWS
─────────────────                            ───
APPVAR_GOOGLE_CLIENT_ID  ── deploy-ecs.yml ──┐
APPVAR_JWT_SECRET        ── deploy-ecs.yml ──┤
APPVAR_DATABASE_URL      ── deploy-ecs.yml ──┤  fetch task def
APPVAR_ADMIN_EMAILS      ── deploy-ecs.yml ──┤   ──► strip APPVAR_
APPVAR_MODEL_S3_BUCKET   ── deploy-ecs.yml ──┤   ──► merge dans environment[]
APPVAR_MODEL_S3_KEY      ── deploy-ecs.yml ──┘   ──► register-task-definition
                                                 ──► update-service
                                                 ──► wait services-stable
```

Ajouter une variable d'app = (1) créer une entrée `APPVAR_*` dans la UI GitHub
+ (2) ajouter la ligne correspondante dans le bloc `env:` de `deploy-ecs.yml`,
puis relancer le workflow. La double declaration est volontaire : la liste
explicite des `APPVAR_*` reste visible et code-reviewable dans le YAML.

## Variables à créer dans GitHub

`Settings` → `Secrets and variables` → `Actions`

### Onglet **Variables** (valeurs non sensibles, visibles en clair dans les logs)

Variables d'infrastructure, lues par le workflow lui-même. Elles ont toutes
un défaut : si vous gardez les noms du template, rien à créer. Si vous nommez
votre cluster ou vos services autrement, créez la Variable correspondante.

| Clé GitHub               | Défaut si absente              | À créer si…                          |
|--------------------------|-------------------------------|--------------------------------------|
| `AWS_REGION`             | `eu-west-1`                   | votre région diffère                 |
| `ECS_CLUSTER`            | `projet-cloud-cluster`        | votre cluster a un autre nom         |
| `ECS_BACKEND_SERVICE`    | `projet-cloud-backend-service`| votre service backend a un autre nom |
| `ECS_FRONTEND_SERVICE`   | `projet-cloud-frontend-service`| votre service frontend a un autre nom |

Variables d'application, injectées dans le conteneur via le pattern `APPVAR_*` :

| Clé GitHub                  | Devient dans le conteneur | Valeur exemple                                        |
|-----------------------------|---------------------------|-------------------------------------------------------|
| `APPVAR_GOOGLE_CLIENT_ID`   | `GOOGLE_CLIENT_ID`        | `361338…apps.googleusercontent.com`                   |
| `APPVAR_ADMIN_EMAILS`       | `ADMIN_EMAILS`            | `prof@2ie.edu.bf,etudiant@2ie.edu.bf`                 |
| `APPVAR_MODEL_S3_BUCKET`    | `MODEL_S3_BUCKET`         | `2ie-groupe03-models`                                 |
| `APPVAR_MODEL_S3_KEY`       | `MODEL_S3_KEY`            | `model.pkl`                                           |
| `APPVAR_AWS_REGION`         | `AWS_REGION` (conteneur)  | `eu-west-1`                                           |

### Onglet **Secrets** (valeurs masquées dans les logs)

| Clé GitHub                  | Devient dans le conteneur | Notes                                                 |
|-----------------------------|---------------------------|-------------------------------------------------------|
| `AWS_ROLE_TO_ASSUME`        | (utilisé par OIDC)        | ARN du rôle IAM avec confiance vers GitHub OIDC       |
| `APPVAR_JWT_SECRET`         | `JWT_SECRET`              | `openssl rand -hex 32`                                |
| `APPVAR_DATABASE_URL`       | `DATABASE_URL`            | `postgresql://user:****@host:5432/db`                 |

> Règle simple : **sensible = onglet Secrets, non sensible = onglet Variables**.
> Dans les deux cas, préfixer par `APPVAR_` pour que le workflow l'injecte.

## Permissions IAM nécessaires

Sur le rôle pointé par `AWS_ROLE_TO_ASSUME` (en plus des droits ECR déjà
requis pour `ci-cd.yml`) :

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "ecs:DescribeServices",
        "ecs:DescribeTaskDefinition",
        "ecs:RegisterTaskDefinition",
        "ecs:UpdateService",
        "ecs:ListTasks",
        "ecs:DescribeTasks"
      ],
      "Resource": "*"
    },
    {
      "Effect": "Allow",
      "Action": "iam:PassRole",
      "Resource": [
        "arn:aws:iam::<ACCOUNT_ID>:role/ecsTaskExecutionRole",
        "arn:aws:iam::<ACCOUNT_ID>:role/projet-cloud-backend-task-role"
      ]
    }
  ]
}
```

`iam:PassRole` est obligatoire : `register-task-definition` re-référence
`executionRoleArn` et `taskRoleArn`, et AWS exige le droit de passer ces
rôles à ECS.

## Lancer un déploiement

Onglet **Actions** → workflow **Deploy to ECS** → bouton **Run workflow**.

Deux paramètres optionnels :

- **`image_tag`** — tag d'image dans ECR à déployer (défaut : `latest`).
  Pour déployer un commit précis, utiliser le SHA court : `image_tag=abc1234`.
- **`services`** — `both` (défaut), `backend` seul, ou `frontend` seul.

Le workflow tourne en parallèle pour les services choisis (matrix), patche
chacune des task definitions, et attend `services-stable` avant de finir.

## Modifier une variable

1. UI GitHub → modifier la valeur (Variable ou Secret).
2. Relancer le workflow `Deploy to ECS`.
3. Une nouvelle révision de task definition est créée avec la nouvelle valeur.
4. ECS bascule en rolling deployment (zero downtime sur 2 tasks).

Aucune commande locale. Aucun commit. Aucune intervention console.

## Ajouter une nouvelle variable d'application

1. UI GitHub → ajouter `APPVAR_MA_NOUVELLE_VAR` (Variable ou Secret).
2. Editer `.github/workflows/deploy-ecs.yml` → ajouter dans le bloc `env:` du
   step *Render task definition...* :
   ```yaml
   APPVAR_MA_NOUVELLE_VAR: ${{ vars.APPVAR_MA_NOUVELLE_VAR }}
   # ou : ${{ secrets.APPVAR_MA_NOUVELLE_VAR }} si sensible
   ```
3. Commit + push, puis relancer le workflow.

Le code Python lit `os.environ["MA_NOUVELLE_VAR"]` comme d'habitude — la
variable est injectée par ECS au démarrage du conteneur, et le préfixe
`APPVAR_` est strippé.

## Migrer une valeur hard-codée depuis la console ECS

Si une valeur traîne en clair dans une task definition créée à la main
(typiquement après le TP ECS), on la remplace ainsi :

1. Créer `APPVAR_<NOM>` dans GitHub.
2. Relancer le workflow `Deploy to ECS`.

Le workflow détecte que `<NOM>` existe déjà dans `environment[]` et le
**remplace** par la nouvelle entrée (voir l'étape 4 de `deploy-ecs.yml`).

## Pièges classiques

| Symptôme                                                | Cause                                                              |
|---------------------------------------------------------|--------------------------------------------------------------------|
| Workflow échoue sur `register-task-definition` avec `AccessDeniedException` | Le rôle n'a pas `iam:PassRole` sur `ecsTaskExecutionRole` ou le task role |
| Workflow échoue sur `update-service` avec `ServiceNotFoundException` | Le nom du service ECS ne correspond pas, ou mauvais cluster        |
| La variable ne change pas dans le conteneur            | Pas relancé le workflow après la modif UI                          |
| `JWT_SECRET` apparaît en clair dans les logs            | Tu l'as mis dans **Variables** au lieu de **Secrets**              |
| `Wait services-stable` timeout                          | La task crash au démarrage — vérifier les logs CloudWatch          |

## Pourquoi ce pattern

Cette approche reprend (en plus simple) le pattern GitLab CI utilisé en
production par des équipes plus matures : `infra/gitlab-templates/ecs-deployment.yml`
chez DOCFIRA. L'avantage clé pour les étudiants :

- la task definition n'est **pas commitée** → pas de secret dans le repo
- la variable se modifie dans **une UI** → pas besoin de CLI AWS
- un seul fichier workflow → réutilisable tel quel
