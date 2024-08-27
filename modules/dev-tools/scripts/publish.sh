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
  stopPublish=
  if [ -z "$uncommittedChanges" ]; then
    # verify changelog
    grep -e "^##.*\\b${newVersion}\\b" CHANGELOG.md ||
      (print_red "\nerror: ${newVersion} not found in CHANGELOG\n" && stopPublish=1)
  else
    print_red "\nerror: Working tree has uncommitted changes\n"
    stopPublish=1
  fi

  # if failed, reset the version bump
  if [ "$stopPublish" == "1" ]; then
     git tag -d "${newVersion}"
     git reset HEAD~ &&
     exit 1
  fi

  # push to branch
  (set -x; git push --no-verify && git push --tags --no-verify)
}

publishToNPM() {
  local tag=$1
  if [ -d "modules" ]; then
    if [ -z $tag ]; then
      # use default tag ('latest' or publishConfig.tag in package.json)
      (set -x; npx lerna publish from-package --force-publish --yes --no-commit-hooks)
    else
      (set -x; npx lerna publish from-package --force-publish --yes --dist-tag $tag --no-commit-hooks)
    fi
  else
    if [ -z $tag ]; then
      (set -x; npm publish)
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
    publishToNPM ${2:-beta}
    ;;

  "prod")
    bumpVersion prod
    publishToNPM $2
    ;;

  "from-git")
    # publish from existing tag
    gitTag=$(git describe --tags)
    if [[ $gitTag == *"-"* ]]; then
      publishToNPM ${2:-beta}
    else
      publishToNPM $2
    fi
    ;;

  *)
    echo -e "\033[91mUnknown publish mode. ocular-publish ['prod' | 'beta' | 'version-only-prod' | 'version-only-beta' | 'from-git']\033[0m"
    exit 1;;
esac
