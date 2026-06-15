#!/usr/bin/env bash
set -euo pipefail

# Git Bash / MSYS sur Windows transforme les valeurs commencant par "/" en
# chemin Windows (ex. /api -> C:/Program Files/Git/api) avant docker.exe.
# Sans cette ligne, --build-arg VITE_API_URL=/api est sabote.
export MSYS_NO_PATHCONV=1

if [ -f .env ]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

: "${AWS_ACCOUNT_ID:?Definir AWS_ACCOUNT_ID dans env ou .env}"

AWS_REGION="${AWS_REGION:-eu-west-1}"
IMAGE_TAG="${IMAGE_TAG:-latest}"
BACKEND_REPO="${BACKEND_REPO:-projet-cloud-backend}"
FRONTEND_REPO="${FRONTEND_REPO:-projet-cloud-frontend}"
REGISTRY="${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com"
VITE_API_URL="${VITE_API_URL:-/api}"
VITE_GOOGLE_CLIENT_ID="${VITE_GOOGLE_CLIENT_ID:-}"

aws ecr describe-repositories --repository-names "${BACKEND_REPO}" --region "${AWS_REGION}" >/dev/null 2>&1 \
  || aws ecr create-repository --repository-name "${BACKEND_REPO}" --region "${AWS_REGION}" >/dev/null

aws ecr describe-repositories --repository-names "${FRONTEND_REPO}" --region "${AWS_REGION}" >/dev/null 2>&1 \
  || aws ecr create-repository --repository-name "${FRONTEND_REPO}" --region "${AWS_REGION}" >/dev/null

aws ecr get-login-password --region "${AWS_REGION}" \
  | docker login --username AWS --password-stdin "${REGISTRY}"

docker build \
  -t "${REGISTRY}/${BACKEND_REPO}:${IMAGE_TAG}" \
  backend

docker build \
  --build-arg "VITE_API_URL=${VITE_API_URL}" \
  --build-arg "VITE_GOOGLE_CLIENT_ID=${VITE_GOOGLE_CLIENT_ID}" \
  -t "${REGISTRY}/${FRONTEND_REPO}:${IMAGE_TAG}" \
  frontend

docker push "${REGISTRY}/${BACKEND_REPO}:${IMAGE_TAG}"
docker push "${REGISTRY}/${FRONTEND_REPO}:${IMAGE_TAG}"

echo "Images ECR poussées :"
echo "- ${REGISTRY}/${BACKEND_REPO}:${IMAGE_TAG}"
echo "- ${REGISTRY}/${FRONTEND_REPO}:${IMAGE_TAG}"
