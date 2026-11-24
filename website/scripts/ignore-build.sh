#!/bin/sh
# Vercel's ignore step: exit 0 skips the build, exit 1 builds. Skip only when Vercel knows the
# previous deploy and nothing the site is built from changed since. A first deploy, or a
# previous commit missing from the clone, builds.
previous="$VERCEL_GIT_PREVIOUS_SHA"
if [ -z "$previous" ] || ! git cat-file -e "$previous^{commit}" 2>/dev/null; then
  exit 1
fi
git diff --quiet "$previous" HEAD -- :/website :/packages :/examples :/package.json :/pnpm-lock.yaml :/pnpm-workspace.yaml
