#!/usr/bin/env bash
# Exercise the workflow's actual deployment commands against a local Git remote.
set -euo pipefail
cd "$(dirname "$0")/.."
scratch=$(mktemp -d "${TMPDIR:-/tmp}/choseiqun-deploy.XXXXXX")
trap 'rm -rf "$scratch"' EXIT

ruby -ryaml -e '
  workflow = YAML.safe_load(File.read(ARGV[0]), aliases: true)
  steps = workflow.fetch("jobs").fetch("publish").fetch("steps")
  puts steps.find { |step| step["name"] == "Update deploy image" }.fetch("run")
' .github/workflows/build-image.yml > "$scratch/update.sh"
bash -n "$scratch/update.sh"

git init --bare "$scratch/remote.git" >/dev/null
git init -b main "$scratch/source" >/dev/null
git -C "$scratch/source" config user.name Test
git -C "$scratch/source" config user.email test@example.invalid
printf 'source files must not be deployed\n' > "$scratch/source/source.txt"
git -C "$scratch/source" add source.txt
git -C "$scratch/source" commit -m source >/dev/null
git -C "$scratch/source" remote add origin "$scratch/remote.git"
git -C "$scratch/source" push origin main

deploy() {
  local branch=$1 sha=$2 checkout=$3
  git clone --quiet --depth=1 --branch main "file://$scratch/remote.git" "$scratch/$checkout"
  (
    cd "$scratch/$checkout"
    DEPLOY_BRANCH=$branch IMAGE="ghcr.io/example/choseiqun:sha-$sha" GITHUB_SHA=$sha \
      bash -e -o pipefail "$scratch/update.sh"
  )
}

remote() {
  git --git-dir="$scratch/remote.git" "$@"
}

deploy deploy 1111111 production
production_head=$(remote rev-parse deploy)
deploy deploy-development 2222222 development
development_head=$(remote rev-parse deploy-development)
test "$(remote ls-tree -r --name-only deploy-development)" = Dockerfile
test "$(remote show deploy-development:Dockerfile)" = 'FROM ghcr.io/example/choseiqun:sha-2222222'
test "$(remote rev-parse deploy)" = "$production_head"

# Repeating the same image must not add a commit.
deploy deploy-development 2222222 repeated
test "$(remote rev-parse deploy-development)" = "$development_head"

# Updating either environment preserves its history and the other environment.
deploy deploy-development 3333333 updated
remote merge-base --is-ancestor "$development_head" deploy-development
test "$(remote show deploy-development:Dockerfile)" = 'FROM ghcr.io/example/choseiqun:sha-3333333'
test "$(remote rev-parse deploy)" = "$production_head"
development_head=$(remote rev-parse deploy-development)
deploy deploy 4444444 production-updated
remote merge-base --is-ancestor "$production_head" deploy
test "$(remote rev-parse deploy-development)" = "$development_head"

# A failed fetch must stop before making a new deployment commit.
git -C "$scratch/updated" remote set-url origin "$scratch/missing.git"
if (
  cd "$scratch/updated"
  DEPLOY_BRANCH=deploy-development IMAGE=ghcr.io/example/choseiqun:sha-5555555 GITHUB_SHA=5555555 \
    bash -e -o pipefail "$scratch/update.sh"
); then
  echo 'Expected fetch failure' >&2
  exit 1
fi
test "$(git -C "$scratch/updated" rev-parse HEAD)" = "$development_head"

# A rejected push must fail without changing the published branch.
printf '#!/bin/sh\nexit 1\n' > "$scratch/remote.git/hooks/pre-receive"
chmod +x "$scratch/remote.git/hooks/pre-receive"
if deploy deploy-development 5555555 rejected; then
  echo 'Expected push rejection' >&2
  exit 1
fi
test "$(remote rev-parse deploy-development)" = "$development_head"
echo 'Deployment branch checks passed.'
