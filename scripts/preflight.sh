#!/usr/bin/env bash
#
# preflight.sh — verifie que votre infra AWS est prete AVANT de lancer
# le workflow "Deploy to ECS". Lecture seule : ce script ne modifie RIEN.
#
# Il rejoue, en automatique, le diagnostic des erreurs les plus frequentes
# vues sur les deploiements etudiants : ALB injoignable, subnet prive,
# Security Group sans sortie, service sur le mauvais target group, image
# figee par digest, variables d'environnement avec des placeholders, modele
# S3 illisible.
#
# Dependances : aws CLI + python (pas besoin de jq).
#
# Usage :
#   bash scripts/preflight.sh
#
# Configuration (memes valeurs que le workflow, surchargeables) :
#   AWS_REGION             defaut eu-west-1
#   ECS_CLUSTER            defaut projet-cloud-cluster
#   ECS_BACKEND_SERVICE    defaut projet-cloud-backend-service
#   ECS_FRONTEND_SERVICE   defaut projet-cloud-frontend-service
#   ECR_BACKEND_REPO       defaut projet-cloud-backend
#   ECR_FRONTEND_REPO      defaut projet-cloud-frontend
#
# Exemple si vous avez nomme votre cluster autrement :
#   ECS_CLUSTER=microscore-cluster ECS_BACKEND_SERVICE=microservice_backend \
#   ECS_FRONTEND_SERVICE=mcroservice_frontend bash scripts/preflight.sh

set -uo pipefail
# Git Bash (Windows) : ne pas transformer les ARNs en chemins Windows.
export MSYS_NO_PATHCONV=1
export MSYS2_ARG_CONV_EXCL='*'

AWS_REGION="${AWS_REGION:-eu-west-1}"
ECS_CLUSTER="${ECS_CLUSTER:-projet-cloud-cluster}"
ECS_BACKEND_SERVICE="${ECS_BACKEND_SERVICE:-projet-cloud-backend-service}"
ECS_FRONTEND_SERVICE="${ECS_FRONTEND_SERVICE:-projet-cloud-frontend-service}"
ECR_BACKEND_REPO="${ECR_BACKEND_REPO:-projet-cloud-backend}"
ECR_FRONTEND_REPO="${ECR_FRONTEND_REPO:-projet-cloud-frontend}"
export AWS_DEFAULT_REGION="$AWS_REGION"

if [ -t 1 ]; then
  G=$'\033[32m'; R=$'\033[31m'; Y=$'\033[33m'; B=$'\033[36m'; Z=$'\033[0m'
else
  G=""; R=""; Y=""; B=""; Z=""
fi

PASS=0; FAIL=0; WARN=0
ok()   { echo "  ${G}OK${Z}   $1"; PASS=$((PASS+1)); }
ko()   { echo "  ${R}FAIL${Z} $1"; [ -n "${2:-}" ] && echo "       -> $2"; FAIL=$((FAIL+1)); }
warn() { echo "  ${Y}WARN${Z} $1"; [ -n "${2:-}" ] && echo "       -> $2"; WARN=$((WARN+1)); }
section() { echo; echo "${B}== $1 ==${Z}"; }

PY="${PYTHON:-python}"
command -v aws >/dev/null 2>&1 || { echo "${R}aws CLI introuvable.${Z}"; exit 2; }
command -v "$PY" >/dev/null 2>&1 || PY=python3
command -v "$PY" >/dev/null 2>&1 || { echo "${R}python introuvable.${Z}"; exit 2; }

# q : un champ via aws --query (texte). Renvoie vide si absent.
q() { aws "$@" --output text 2>/dev/null; }

echo "Preflight — verification avant Deploy to ECS"
echo "Region=$AWS_REGION  Cluster=$ECS_CLUSTER"
echo "Services: $ECS_BACKEND_SERVICE / $ECS_FRONTEND_SERVICE"

# ============================================================================
section "Identite AWS"
ACCOUNT=$(q sts get-caller-identity --query Account)
if [ -z "$ACCOUNT" ]; then
  ko "Impossible de s'authentifier" "Verifiez vos credentials (aws configure) ou le rôle assume."
  echo; echo "Arret : sans identite valide, le reste n'a pas de sens."; exit 1
fi
ok "Authentifie sur le compte $ACCOUNT"

# ============================================================================
section "Cluster et services ECS"
if q ecs describe-clusters --clusters "$ECS_CLUSTER" \
     --query 'clusters[0].status' | grep -q ACTIVE; then
  ok "Cluster $ECS_CLUSTER existe"
else
  ko "Cluster $ECS_CLUSTER introuvable" \
     "Creez-le, ou passez ECS_CLUSTER=<votre-nom> au script et au workflow."
fi

check_service() {
  local role="$1" name="$2" want_port="$3"
  local status
  status=$(q ecs describe-services --cluster "$ECS_CLUSTER" --services "$name" \
    --query 'services[0].status')
  if [ "$status" != "ACTIVE" ]; then
    ko "Service $role ($name) introuvable ou inactif" \
       "Creez le service, ou ajustez la variable du nom de service."
    return
  fi
  ok "Service $role ($name) actif"

  local base=(ecs describe-services --cluster "$ECS_CLUSTER" --services "$name")

  # target group
  local tg
  tg=$(q "${base[@]}" --query 'services[0].loadBalancers[0].targetGroupArn')
  if [ -z "$tg" ] || [ "$tg" = "None" ]; then
    ko "$role : aucun target group attache" \
       "Attachez le service au target group port $want_port."
  else
    local tgport
    tgport=$(q elbv2 describe-target-groups --target-group-arns "$tg" \
      --query 'TargetGroups[0].Port')
    if [ "$tgport" = "$want_port" ]; then
      ok "$role -> target group port $tgport"
    else
      ko "$role attache a un target group port $tgport (attendu $want_port)" \
         "backend et frontend sont peut-etre inverses. Le $role doit pointer le port $want_port."
    fi
  fi

  # assignPublicIp
  local pubip
  pubip=$(q "${base[@]}" --query 'services[0].networkConfiguration.awsvpcConfiguration.assignPublicIp')
  if [ "$pubip" = "ENABLED" ]; then
    ok "$role : assignPublicIp ENABLED"
  else
    warn "$role : assignPublicIp ${pubip:-DISABLED}" \
         "En subnet public sans NAT, mettez ENABLED pour atteindre ECR."
  fi

  # subnets publics
  local subnets sub vpc routes has_igw
  subnets=$(q "${base[@]}" --query 'services[0].networkConfiguration.awsvpcConfiguration.subnets')
  for sub in $subnets; do
    routes=$(aws ec2 describe-route-tables \
      --filters "Name=association.subnet-id,Values=$sub" \
      --query 'RouteTables[0].Routes' --output json 2>/dev/null)
    if [ "$routes" = "null" ] || [ -z "$routes" ]; then
      vpc=$(q ec2 describe-subnets --subnet-ids "$sub" --query 'Subnets[0].VpcId')
      routes=$(aws ec2 describe-route-tables \
        --filters "Name=vpc-id,Values=$vpc" "Name=association.main,Values=true" \
        --query 'RouteTables[0].Routes' --output json 2>/dev/null)
    fi
    has_igw=$(echo "$routes" | "$PY" -c 'import sys,json
try: r=json.load(sys.stdin) or []
except Exception: r=[]
print(sum(1 for x in r if str(x.get("GatewayId","")).startswith("igw-")))')
    if [ "${has_igw:-0}" -ge 1 ]; then
      ok "$role : subnet $sub public (route IGW)"
    else
      ko "$role : subnet $sub PAS public" \
         "Associez $sub a une route table avec 0.0.0.0/0 -> Internet Gateway."
    fi
  done

  # SG : sortie ouverte
  local sgs sg egress n
  sgs=$(q "${base[@]}" --query 'services[0].networkConfiguration.awsvpcConfiguration.securityGroups')
  for sg in $sgs; do
    egress=$(aws ec2 describe-security-groups --group-ids "$sg" \
      --query 'SecurityGroups[0].IpPermissionsEgress' --output json 2>/dev/null)
    n=$(echo "$egress" | "$PY" -c 'import sys,json
try: print(len(json.load(sys.stdin) or []))
except Exception: print(0)')
    if [ "${n:-0}" -ge 1 ]; then
      ok "$role : SG $sg a une sortie"
    else
      ko "$role : SG $sg sans sortie" \
         "Ajoutez une sortie All traffic 0.0.0.0/0 sur $sg (sinon pas d'acces ECR)."
    fi
  done

  # task def : image + placeholders
  local td img envjson
  td=$(q "${base[@]}" --query 'services[0].taskDefinition')
  img=$(q ecs describe-task-definition --task-definition "$td" \
    --query 'taskDefinition.containerDefinitions[0].image')
  if echo "$img" | grep -q '@sha256:'; then
    warn "$role : image figee par digest" \
         "Epinglee ($img). Un push :latest ne sera pas pris. Preferez un tag mobile."
  else
    ok "$role : image par tag ($img)"
  fi
  envjson=$(aws ecs describe-task-definition --task-definition "$td" \
    --query 'taskDefinition.containerDefinitions[0].environment' --output json 2>/dev/null)
  local bad
  bad=$(echo "$envjson" | "$PY" -c 'import sys,json,re
try: env=json.load(sys.stdin) or []
except Exception: env=[]
out=[]
for e in env:
    n=e.get("name",""); v=str(e.get("value",""))
    if re.search(r"[<>]|\.\.\.|--region", v) or re.search(r"[a-z] - [a-z]", v) \
       or (n=="JWT_SECRET" and v.startswith("GOCSPX-")):
        out.append(f"{n}={v}")
print("; ".join(out))')
  if [ -n "$bad" ]; then
    ko "$role : variables d'environnement suspectes (placeholder non remplace)" "$bad"
  else
    ok "$role : variables d'environnement sans placeholder evident"
  fi
}

check_service "backend"  "$ECS_BACKEND_SERVICE"  "8000"
check_service "frontend" "$ECS_FRONTEND_SERVICE" "80"

# ============================================================================
section "ALB joignable depuis internet"
BTG=$(q ecs describe-services --cluster "$ECS_CLUSTER" --services "$ECS_BACKEND_SERVICE" \
  --query 'services[0].loadBalancers[0].targetGroupArn')
if [ -z "$BTG" ] || [ "$BTG" = "None" ]; then
  warn "ALB non verifie" "Le service backend n'a pas de target group, impossible de remonter a l'ALB."
else
  LB=$(q elbv2 describe-target-groups --target-group-arns "$BTG" \
    --query 'TargetGroups[0].LoadBalancerArns[0]')
  if [ -z "$LB" ] || [ "$LB" = "None" ]; then
    ko "Target group backend non rattache a un ALB" "Attachez-le a un listener de l'ALB."
  else
    SCHEME=$(q elbv2 describe-load-balancers --load-balancer-arns "$LB" \
      --query 'LoadBalancers[0].Scheme')
    [ "$SCHEME" = "internet-facing" ] && ok "ALB internet-facing" \
      || warn "ALB scheme=$SCHEME" "Pour un acces public, l'ALB doit etre internet-facing."

    NLIST=$(q elbv2 describe-listeners --load-balancer-arn "$LB" --query 'length(Listeners)')
    [ "${NLIST:-0}" -ge 1 ] && ok "ALB a $NLIST listener(s)" \
      || ko "ALB sans listener" "Ajoutez un listener HTTP:80."

    OPEN=0
    for sg in $(q elbv2 describe-load-balancers --load-balancer-arns "$LB" \
        --query 'LoadBalancers[0].SecurityGroups'); do
      n=$(q ec2 describe-security-groups --group-ids "$sg" \
        --query "length(SecurityGroups[0].IpPermissions[?contains(IpRanges[].CidrIp, '0.0.0.0/0')])")
      [ "${n:-0}" != "None" ] && [ "${n:-0}" -ge 1 ] 2>/dev/null && OPEN=1
    done
    if [ "$OPEN" = "1" ]; then
      ok "Security Group de l'ALB ouvert depuis 0.0.0.0/0"
    else
      ko "Aucun SG de l'ALB n'autorise l'entree depuis internet" \
         "Attachez a l'ALB un SG avec inbound 80/443 depuis 0.0.0.0/0. Le SG 'default' ne suffit pas."
    fi
  fi
fi

# ============================================================================
section "Depots ECR et images"
for repo in "$ECR_BACKEND_REPO" "$ECR_FRONTEND_REPO"; do
  cnt=$(q ecr describe-images --repository-name "$repo" --query 'length(imageDetails)')
  if [ -z "$cnt" ] || [ "$cnt" = "None" ]; then
    ko "Depot ECR $repo introuvable" "Lancez ci-cd.yml (push sur main) pour creer et remplir le depot."
  elif [ "$cnt" -ge 1 ] 2>/dev/null; then
    ok "Depot ECR $repo : $cnt image(s)"
  else
    warn "Depot ECR $repo vide" "Aucune image. Lancez ci-cd.yml avant de deployer."
  fi
done

# ============================================================================
section "Modele ML sur S3 (backend)"
BTD=$(q ecs describe-services --cluster "$ECS_CLUSTER" --services "$ECS_BACKEND_SERVICE" \
  --query 'services[0].taskDefinition')
if [ -n "$BTD" ] && [ "$BTD" != "None" ]; then
  BUCKET=$(q ecs describe-task-definition --task-definition "$BTD" \
    --query "taskDefinition.containerDefinitions[0].environment[?name=='MODEL_S3_BUCKET'].value | [0]")
  KEY=$(q ecs describe-task-definition --task-definition "$BTD" \
    --query "taskDefinition.containerDefinitions[0].environment[?name=='MODEL_S3_KEY'].value | [0]")
  [ -z "$KEY" ] || [ "$KEY" = "None" ] && KEY="model.pkl"
  if [ -z "$BUCKET" ] || [ "$BUCKET" = "None" ]; then
    warn "MODEL_S3_BUCKET non defini" "Le backend utilisera son modele de secours. OK pour debuter."
  elif aws s3api head-object --bucket "$BUCKET" --key "$KEY" >/dev/null 2>&1; then
    ok "Modele present : s3://$BUCKET/$KEY"
  else
    ko "Modele introuvable ou illisible : s3://$BUCKET/$KEY" \
       "Verifiez le nom EXACT du bucket (aws s3 ls), que $KEY y est, et le s3:GetObject du task role."
  fi
fi

# ============================================================================
echo
echo "${B}== Resultat ==${Z}"
echo "  ${G}$PASS OK${Z}   ${Y}$WARN WARN${Z}   ${R}$FAIL FAIL${Z}"
if [ "$FAIL" -gt 0 ]; then
  echo "${R}Erreurs bloquantes. Corrigez-les avant de lancer Deploy to ECS.${Z}"
  exit 1
fi
[ "$WARN" -gt 0 ] && echo "${Y}Pas d'erreur bloquante, mais regardez les avertissements.${Z}"
echo "${G}Pret pour Deploy to ECS.${Z}"
