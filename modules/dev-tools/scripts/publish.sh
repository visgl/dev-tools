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

  # push to branch
  (set -x; git push --no-verify && git push --tags --no-verify)
}

publishToNPM() {
  # Try add release to GitHub
  node $DEV_TOOLS_DIR/dist/github-release.js

  local tag=`node $DEV_TOOLS_DIR/dist/helpers/get-npm-dist-tag.js`
  if [ -d "modules" ]; then
    (set -x; npx lerna publish from-package --force-publish --yes --dist-tag $tag --no-commit-hooks)
  else
    (set -x; npm publish --tag $tag)
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
