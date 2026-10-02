#!/usr/bin/env bash
#
# Replays this fork's commits on top of upstream spliit, the way
# "Maintaining this fork" in the README describes it.
#
#   ./scripts/sync-upstream.sh            fetch, mirror main, rebase, verify
#   ./scripts/sync-upstream.sh check      only run the verification checks
#   ./scripts/sync-upstream.sh continue   after resolving conflicts: finish the
#                                         rebase, then verify
#   ./scripts/sync-upstream.sh diff       show what the fork adds to upstream
#
# Nothing is pushed: the last thing the script does is print the two push
# commands, so the rebase can be reviewed first.
#
# Env:
#   FORK_BRANCH     the fork's branch (default mkloouo-spliit-fork)
#   UPSTREAM_URL    upstream remote URL, added on first run
set -euo pipefail
cd "$(dirname "$0")/.."

FORK_BRANCH="${FORK_BRANCH:-mkloouo-spliit-fork}"
UPSTREAM_URL="${UPSTREAM_URL:-https://github.com/spliit-app/spliit.git}"

say() { printf '\n==> %s\n' "$*"; }
die() { printf '\nerror: %s\n' "$*" >&2; exit 1; }

# `npm ci --ignore-scripts` on purpose: postinstall runs `prisma migrate
# deploy`, which needs a reachable database. `prisma generate` then writes the
# client into src/generated/prisma, which check-types needs.
check() {
  say 'Installing dependencies'
  npm ci --ignore-scripts
  npx prisma generate

  say 'Checking types, tests and formatting'
  npm run check-types
  npm test
  npm run check-formatting

  say 'Checking the fork-specific pieces are still wired up'
  # Each of these is a place upstream could plausibly rewrite out from under
  # the fork without any of the checks above noticing.
  grep -q 'model ExpenseItem' prisma/schema.prisma ||
    die 'prisma/schema.prisma no longer defines ExpenseItem'
  grep -q 'geminiApiKey' prisma/schema.prisma ||
    die 'prisma/schema.prisma no longer defines Group.geminiApiKey'
  grep -q 'ItemsField' messages/en-US.json ||
    die 'messages/en-US.json lost the fork’s ExpenseForm.ItemsField strings'
  grep -q 'ReceiptScanning' messages/en-US.json ||
    die 'messages/en-US.json lost the fork’s GroupForm.ReceiptScanning strings'
  for file in src/lib/items.ts src/lib/gemini.ts src/lib/gemini-key.ts \
    src/lib/uploads.ts src/lib/image-upload.ts \
    'src/app/api/uploads/[name]/route.ts' \
    'src/app/groups/[groupId]/expenses/expense-items-input.tsx' \
    'src/app/groups/[groupId]/expenses/receipt-items.ts'; do
    [ -f "$file" ] || die "$file is gone"
  done

  say 'All checks passed'
}

summary() {
  say "What the fork adds on top of upstream (git diff main...$FORK_BRANCH)"
  git diff --stat "main...$FORK_BRANCH"
  printf '\nCommits:\n'
  git log --oneline "main..$FORK_BRANCH"
}

push_hint() {
  cat <<EOF

Nothing has been pushed. When the rebase looks right:

  git push origin main
  git push --force-with-lease origin $FORK_BRANCH

EOF
}

case "${1:-sync}" in
check)
  check
  ;;

diff)
  summary
  ;;

continue)
  say 'Finishing the rebase'
  git rebase --continue
  check
  summary
  push_hint
  ;;

sync)
  [ -z "$(git status --porcelain)" ] ||
    die 'the working tree is dirty; commit or stash first'

  git remote get-url upstream >/dev/null 2>&1 || {
    say "Adding the upstream remote ($UPSTREAM_URL)"
    git remote add upstream "$UPSTREAM_URL"
    # --no-tags, or every fetch drags upstream's release tags in. They are not
    # this fork's releases, and pushing them would publish an upstream build
    # as `:latest` (cd.yml re-points it on any tag push).
    git config remote.upstream.tagOpt --no-tags
  }

  say 'Fetching upstream'
  git fetch upstream

  # main is a pure mirror of upstream/main and is never committed to, so it can
  # only ever fast-forward. A rejected --ff-only means something was committed
  # to it by mistake, which is worth stopping for.
  say 'Fast-forwarding the main mirror'
  git checkout main
  git merge --ff-only upstream/main ||
    die 'main is not a pure mirror of upstream/main any more; fix it by hand'

  say "Replaying $FORK_BRANCH on top of main"
  git checkout "$FORK_BRANCH"
  if ! git rebase main; then
    cat <<EOF

The rebase stopped on a conflict. Resolve it, 'git add' the files, then:

  ./scripts/sync-upstream.sh continue

Or abandon the whole thing with 'git rebase --abort'.
EOF
    exit 1
  fi

  check
  summary
  push_hint
  ;;

*)
  die "unknown command '$1' (try: sync, continue, check, diff)"
  ;;
esac
