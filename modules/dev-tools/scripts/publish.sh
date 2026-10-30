#!/bin/bash
# Script to publish modules

set -e

usage() {
  # TODO: Add more specific url
  open "https://uber-web.github.io/ocular/docs/dev-tools/cli/ocular-publish"
}

# beta, prod, version-only-beta, version-only-prod or from-git
MODE=$1
DEV_TOOLS_DIR=$(dirname $0)/..

print_red() {
  echo -e "\033[31m${1}\033[0m"
}

bumpVersion() {
  local versionType
  if [[ $1 == "beta" ]]; then
    versionType=prerelease
  else
    versionType=patch
  fi

  if [ -d "modules" ]; then
    (set -x; npx lerna version $versionType --force-publish --exact --no-commit-hooks --no-push)
  else
    # -f includes any changes in the version commit
    (set -x; npm version $versionType --force)
  fi

  newVersion=`git describe`
  uncommittedChanges=`git status --porcelain`
  stopPublish=0
  if [ -z "$uncommittedChanges" ]; then
    # verify changelog
    if ! grep -q -e "^##.*\\b${newVersion}\\b" CHANGELOG.md; then
      print_red "\nerror: ${newVersion} not found in CHANGELOG\n"
      stopPublish=1
    fi
  else
    print_red "\nerror: Working tree has uncommitted changes\n"
    stopPublish=1
  fi

  # if failed, reset the version bump
  if [ $stopPublish -eq 1 ]; then
     git tag -d "${newVersion}"
     git reset HEAD~ &&
     exit 1
  fi

  # Push the branch, then only the tags on the version commit, to the same remote that `git push`
  # picks for the branch. `git push --tags` would also push any stray local tags, and GitHub skips
  # tag workflows when more than 3 tags are pushed at once, so the release workflow would never run.
  local branch=`git branch --show-current`
  local remote=`git config "branch.$branch.pushRemote" || git config remote.pushDefault || git config "branch.$branch.remote" || echo origin`
  local tags=`git tag --points-at HEAD | sed 's#^#refs/tags/#'`
  (set -x; git push --no-verify && git push --no-verify $remote $tags)
}

publishToNPM() {
  # Try add release to GitHub
  node $DEV_TOOLS_DIR/dist/github-release.js

  local tag=`node $DEV_TOOLS_DIR/dist/helpers/get-npm-dist-tag.js`
  if [ -d "modules" ]; then
    # `from-package` skips versions already on npm, so retrying only publishes the packages
    # that failed, e.g. on npm's intermittent provenance TLOG_CREATE_ENTRY_ERROR (409).
    # Wait between attempts: new versions can take a few minutes to show up on the registry, and
    # retrying sooner can fail with "cannot publish over the previously published versions".
    local attempts=3
    local delay=120
    local attempt=1
    until (set -x; npx lerna publish from-package --force-publish --yes --dist-tag $tag --no-commit-hooks); do
      if [ $attempt -ge $attempts ]; then
        print_red "\nerror: some packages failed to publish after $attempt attempts. Run \`ocular-publish from-git\` again to publish the rest.\n"
        exit 1
      fi
      attempt=$((attempt + 1))
      print_red "\nSome packages failed to publish. Retrying in ${delay}s (attempt $attempt of $attempts)\n"
      sleep $delay
    done
  else
    local name=`node -p "require('./package.json').name"`
    local version=`node -p "require('./package.json').version"`
    # Check the registry that `npm publish` uses
    local registry=`node -p "require('./package.json').publishConfig?.registry || ''"`
    if [ -n "`npm view "$name@$version" version ${registry:+--registry "$registry"} 2>/dev/null`" ]; then
      echo "$name@$version is already published"
    else
      (set -x; npm publish --tag $tag)
    fi
  fi
}

case $MODE in
  "help")
    usage
    ;;

  "version-only-beta")
    bumpVersion beta
    ;;

  "version-only-prod")
    bumpVersion prod
    ;;

  "beta")
    bumpVersion beta
    publishToNPM
    ;;

  "prod")
    bumpVersion prod
    publishToNPM
    ;;

  "from-git")
    # publish from existing tag
    publishToNPM
    ;;

  *)
    echo -e "\033[91mUnknown publish mode. ocular-publish ['prod' | 'beta' | 'version-only-prod' | 'version-only-beta' | 'from-git']\033[0m"
    exit 1;;
esac
