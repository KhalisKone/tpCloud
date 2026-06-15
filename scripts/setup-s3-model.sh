#!/usr/bin/env bash
set -euo pipefail

if [ -f .env ]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

: "${MODEL_S3_BUCKET:?Definir MODEL_S3_BUCKET, ex: 2ie-<groupe>-models}"

AWS_REGION="${AWS_REGION:-eu-west-1}"
MODEL_S3_KEY="${MODEL_S3_KEY:-model.pkl}"
LOCAL_MODEL_PATH="${LOCAL_MODEL_PATH:-backend/models/model.pkl}"

if [ ! -f "${LOCAL_MODEL_PATH}" ]; then
  echo "Modele local introuvable: ${LOCAL_MODEL_PATH}"
  echo "Generer d'abord le modele avec: cd backend && uv run python ../scripts/train.py"
  exit 1
fi

if ! aws s3api head-bucket --bucket "${MODEL_S3_BUCKET}" >/dev/null 2>&1; then
  aws s3 mb "s3://${MODEL_S3_BUCKET}" --region "${AWS_REGION}"
fi

aws s3api put-public-access-block \
  --bucket "${MODEL_S3_BUCKET}" \
  --public-access-block-configuration \
  BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true

aws s3 cp "${LOCAL_MODEL_PATH}" "s3://${MODEL_S3_BUCKET}/${MODEL_S3_KEY}"

echo "Modele uploade sur S3 :"
echo "- s3://${MODEL_S3_BUCKET}/${MODEL_S3_KEY}"
