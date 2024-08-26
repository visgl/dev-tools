#!/bin/bash
# Script to check code styles

set -e

# Lint selected directories
# lint.sh DIR1,DIR2
MODE=$1

DEV_TOOLS_DIR=$(dirname $0)/..

DIRECTORIES=`node $DEV_TOOLS_DIR/dist/helpers/get-config.js ".lint.paths"`
EXTENSIONS=`node $DEV_TOOLS_DIR/dist/helpers/get-config.js ".lint.extensions"`
if [[ $EXTENSIONS == *","* ]]; then
  EXTENSIONS={$EXTENSIONS}
fi

DIR_PATTERN=
IFS=',' read -r -a DIR_ARRAY <<< "$DIRECTORIES"
for dir in "${DIR_ARRAY[@]}"
do
  DIR_PATTERN+="$dir/**/*.$EXTENSIONS "
done

# if no prettier config present, use default template
PRETTIER_CONFIG=`ls .prettierrc* 2> /dev/null || echo "${PRETTIER_CONFIG:=$DEV_TOOLS_DIR/templates/.prettierrc}"`

usage() {
  # TODO: Add more specific url
  open "https://uber-web.github.io/ocular/docs/dev-tools/cli/ocular-lint"
}

print_yellow() {
  echo -e "\033[93m${1}\033[0m"
}

case $MODE in
  "help")
    usage
    ;;

  "pre-commit")
    print_yellow "Running prettier & eslint on changed files..."

    NAME_PATTERN=`echo "^$DIRECTORIES/.*\.$EXTENSIONS$" | sed -e 's/,/|/g' | sed -e 's/{/(/g' | sed -e 's/}/)/g'`

    # only check changed files
    set +e
    FILES=`git diff HEAD --name-only | grep -E "${NAME_PATTERN}"`
    set -e

    FILES_LIST=""

    if [ ! -z "${FILES}" ]; then
      for f in $FILES
        do
          if [ -e "${f}" ]; then
            FILES_LIST+="${f} "
          fi
      done

      (set -x; npx prettier --config $PRETTIER_CONFIG --check $FILES_LIST)
      (set -x; npx eslint $FILES_LIST)
    fi
    ;;

  "fix")
    # eslint has a issue with {dir1,dir2} style filters - it tries to enumerate all files at root before matching
    # this may lead to unexpected error when an incompatible file exists outside of the target directories
    for dir in "${DIR_ARRAY[@]}"
    do
      print_yellow "Checking $dir..."
      (set -x; npx eslint --no-error-on-unmatched-pattern --fix "$dir/**/*.$EXTENSIONS")
      (set -x; npx prettier --log-level warn --config $PRETTIER_CONFIG --write "$dir/**/*.$EXTENSIONS")
    done
    ;;

  *)
    # eslint has a issue with {dir1,dir2} style filters - it tries to enumerate all files at root before matching
    # this may lead to unexpected error when an incompatible file exists outside of the target directories
    for dir in "${DIR_ARRAY[@]}"
    do
      print_yellow "Checking $dir..."
      (set -x; npx eslint --no-error-on-unmatched-pattern "$dir/**/*.$EXTENSIONS")
      (set -x; npx prettier --config $PRETTIER_CONFIG --check "$dir/**/*.$EXTENSIONS" ||
        (echo -e "\033[91mNot all files using prettier code style. This may be fixed by running\033[0m \033[1mnpm run lint fix\033[0m" &&
        exit 1))
    done
    ;;
  esac

# check if yarn.lock contains private registry information
!(grep -q unpm.u yarn.lock) && echo "Lockfile valid." || (echo -e "\033[91mPlease rebuild yarn file using public npmrc\033[0m" && false)
