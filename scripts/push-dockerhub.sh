#!/usr/bin/env bash
set -euo pipefail

if [ -f .env ]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

: "${DOCKERHUB_USERNAME:?Definir DOCKERHUB_USERNAME dans env ou .env}"

IMAGE_TAG="${IMAGE_TAG:-latest}"
export IMAGE_NAMESPACE="${DOCKERHUB_USERNAME}"
export IMAGE_TAG

bash "$(dirname "$0")/build-images.sh"

if [ -n "${DOCKERHUB_TOKEN:-}" ]; then
  echo "Login DockerHub avec DOCKERHUB_TOKEN."
  printf '%s' "${DOCKERHUB_TOKEN}" | docker login \
    --username "${DOCKERHUB_USERNAME}" \
    --password-stdin
else
  echo "DOCKERHUB_TOKEN absent : utilisation de la session Docker locale existante."
fi

push_image() {
  local image="$1"

  if ! docker push "${image}"; then
    cat <<EOF

Erreur DockerHub pendant le push de ${image}.

Verifier :
- le repository existe dans le namespace DockerHub ${DOCKERHUB_USERNAME} ;
- le compte Docker connecte a le droit d'ecrire dans ce namespace ;
- si DOCKERHUB_TOKEN est defini dans .env, il doit etre un token Read & Write.

Commandes utiles :
  docker logout
  docker login -u ${DOCKERHUB_USERNAME}

EOF
    exit 1
  fi
}

push_image "${DOCKERHUB_USERNAME}/projet-cloud-backend:${IMAGE_TAG}"
push_image "${DOCKERHUB_USERNAME}/projet-cloud-frontend:${IMAGE_TAG}"
