#!/bin/bash
# Static-export deploy: build the Next.js export and rsync ./out to the host over SSH.
# Key-based auth only. Configure via environment variables (see .env.example):
#   SSH_HOST     - deploy host (e.g. user-host.example.com)
#   SSH_USER     - SSH user
#   DEPLOY_PATH  - remote web root (e.g. ~/public_html/)
#   SSH_PORT     - optional, defaults to 22
#   SITE_URL     - optional, used by the IndexNow ping
set -euo pipefail

: "${SSH_HOST:?Set SSH_HOST}"
: "${SSH_USER:?Set SSH_USER}"
: "${DEPLOY_PATH:?Set DEPLOY_PATH}"
SSH_PORT="${SSH_PORT:-22}"

echo "-> Building static export..."
npm run build

echo "-> Uploading ./out to ${SSH_USER}@${SSH_HOST}:${DEPLOY_PATH} ..."
rsync -avz --delete \
  -e "ssh -p ${SSH_PORT}" \
  --exclude='404.html' \
  --exclude='404/' \
  --exclude='_not-found/' \
  --exclude='placeholder*' \
  ./out/ \
  "${SSH_USER}@${SSH_HOST}:${DEPLOY_PATH}"

echo "-> Pinging IndexNow..."
node scripts/indexnow.mjs || echo "IndexNow ping skipped"

echo "Done"
