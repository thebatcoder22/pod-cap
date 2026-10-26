#!/bin/sh
# Deploys what is committed on `dev` to https://pod-cap-dev.vercel.app, or on `main` to production.
# Uploads `git archive` of the branch, never the working folder, so local files (.env, test output) stay local.
set -eu

case "${1:-}" in
  dev) branch=dev ;;
  prod) branch=main ;;
  *)
    echo "usage: scripts/deploy.sh dev|prod" >&2
    exit 2
    ;;
esac
scope=backend-development

dir=$(mktemp -d)
trap 'rm -rf "$dir"' EXIT
git archive "$branch" | tar -x -C "$dir"
mkdir "$dir/.vercel"
cp .vercel/project.json "$dir/.vercel/"
echo "Deploying $branch at $(git rev-parse --short "$branch")"

if [ "$1" = prod ]; then
  vercel deploy "$dir" --prod --yes --scope "$scope"
else
  url=$(vercel deploy "$dir" --yes --scope "$scope")
  vercel alias set "$url" pod-cap-dev.vercel.app --scope "$scope"
fi
