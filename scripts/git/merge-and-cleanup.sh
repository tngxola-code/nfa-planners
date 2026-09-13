#!/usr/bin/env bash

set -Eeuo pipefail

PROTECTED_BRANCHES=(
  "main"
  "master"
  "develop"
  "development"
  "staging"
  "production"
)

fail() {
  echo "ERROR: $*" >&2
  exit 1
}

is_protected_branch() {
  local candidate="$1"
  local protected

  for protected in "${PROTECTED_BRANCHES[@]}"; do
    if [[ "$candidate" == "$protected" ]]; then
      return 0
    fi
  done

  return 1
}

command -v git >/dev/null 2>&1 ||
  fail "Git is not installed."

command -v gh >/dev/null 2>&1 ||
  fail "GitHub CLI is not installed."

git rev-parse --is-inside-work-tree >/dev/null 2>&1 ||
  fail "Run this command inside a Git repository."

git diff --quiet ||
  fail "Working tree has unstaged changes."

git diff --cached --quiet ||
  fail "Working tree has staged but uncommitted changes."

CURRENT_BRANCH="$(git branch --show-current)"

[[ -n "$CURRENT_BRANCH" ]] ||
  fail "Detached HEAD is not supported."

if is_protected_branch "$CURRENT_BRANCH"; then
  fail "Refusing to merge or delete protected branch: $CURRENT_BRANCH"
fi

DEFAULT_BRANCH="$(
  gh repo view --json defaultBranchRef \
    --jq '.defaultBranchRef.name'
)"

[[ -n "$DEFAULT_BRANCH" ]] ||
  fail "Could not determine the repository default branch."

if is_protected_branch "$DEFAULT_BRANCH"; then
  :
else
  fail "Unexpected default branch: $DEFAULT_BRANCH"
fi

PR_NUMBER="$(
  gh pr view "$CURRENT_BRANCH" \
    --json number \
    --jq '.number' 2>/dev/null
)" || fail "No pull request exists for $CURRENT_BRANCH."

PR_STATE="$(
  gh pr view "$PR_NUMBER" \
    --json state \
    --jq '.state'
)"

echo "Branch: $CURRENT_BRANCH"
echo "Pull request: #$PR_NUMBER"
echo "Target branch: $DEFAULT_BRANCH"
echo

if [[ "$PR_STATE" == "OPEN" ]]; then
  gh pr checks "$PR_NUMBER" --required

  echo
  echo "Required checks passed. Merging pull request..."

  gh pr merge "$PR_NUMBER" \
    --squash \
    --delete-branch
elif [[ "$PR_STATE" == "MERGED" ]]; then
  echo "Pull request is already merged. Running branch cleanup."
else
  fail "Pull request #$PR_NUMBER cannot be cleaned. Current state: $PR_STATE"
fi

MERGED="$(
  gh pr view "$PR_NUMBER" \
    --json mergedAt \
    --jq '.mergedAt // empty'
)"

[[ -n "$MERGED" ]] ||
  fail "GitHub did not confirm that pull request #$PR_NUMBER was merged."

if [[ "$(git branch --show-current)" != "$DEFAULT_BRANCH" ]]; then
  git switch "$DEFAULT_BRANCH"
fi

git pull --ff-only origin "$DEFAULT_BRANCH"
git fetch origin --prune

if git show-ref --verify --quiet "refs/heads/$CURRENT_BRANCH"; then
  git branch -D "$CURRENT_BRANCH"
fi

if git ls-remote \
  --exit-code \
  --heads origin "$CURRENT_BRANCH" \
  >/dev/null 2>&1; then
  git push origin --delete "$CURRENT_BRANCH"
fi

echo
echo "Merge and cleanup completed."
echo "Merged PR: #$PR_NUMBER"
echo "Deleted local branch: $CURRENT_BRANCH"
echo "Deleted remote branch: origin/$CURRENT_BRANCH"
echo "Current branch: $(git branch --show-current)"
