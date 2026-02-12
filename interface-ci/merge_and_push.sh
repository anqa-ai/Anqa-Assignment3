#!/usr/bin/env bash
set -euo pipefail

# Usage: merge_and_push.sh <TAG_TO_MERGE>
# Called by review_server.py; set env REVIEWER to record reviewer name.

TAG="${1:-}"
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
REVIEWS_DIR="$REPO_ROOT/interface-ci/reviews"
BRANCH_TMP="ci/review-merge-${TAG}"
MAIN_BRANCH="main"
REVIEWER="${REVIEWER:-unknown}"

if [ -z "$TAG" ]; then
  echo "No tag specified" >&2
  exit 2
fi

cd "$REPO_ROOT"

echo "Starting merge process for tag: $TAG (reviewer: $REVIEWER)"
# ensure we have a clean working tree
if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "Repo has uncommitted changes. Please stash or commit before running this script." >&2
  exit 3
fi

# fetch latest
git fetch origin --prune

# create branch from tag
if git show-ref --tags --quiet --verify "refs/tags/$TAG"; then
  # delete tmp branch if exists
  if git show-ref --quiet "refs/heads/$BRANCH_TMP"; then
    git branch -D "$BRANCH_TMP"
  fi
  git checkout -b "$BRANCH_TMP" "tags/$TAG"
else
  echo "Tag $TAG not found." >&2
  exit 4
fi

# checkout main and fast-forward or merge
git checkout "$MAIN_BRANCH"
git pull origin "$MAIN_BRANCH"

# attempt to merge tmp branch
set +e
git merge --no-ff --no-edit "$BRANCH_TMP"
MERGE_EXIT=$?
set -e

if [ $MERGE_EXIT -ne 0 ]; then
  echo "Merge reported conflicts. Aborting merge." >&2
  git merge --abort || true
  # Record a merge-failed file
  echo "{\"tag\":\"$TAG\",\"result\":\"merge_conflict\",\"reviewer\":\"$REVIEWER\",\"time\":\"$(date -u --iso-8601=seconds)\"}" > "$REVIEWS_DIR/merge_${TAG}_failed.json"
  exit 5
fi

# push main
git push origin "$MAIN_BRANCH"

# create a timestamped successful merge record
echo "{\"tag\":\"$TAG\",\"result\":\"merged\",\"reviewer\":\"$REVIEWER\",\"time\":\"$(date -u --iso-8601=seconds)\"}" > "$REVIEWS_DIR/merge_${TAG}_success.json"

echo "Merge and push complete for tag $TAG"
exit 0