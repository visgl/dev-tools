#!/bin/bash

set -e

DEV_TOOLS_DIR=$(dirname $0)/..
MODULES=`node $DEV_TOOLS_DIR/dist/helpers/get-config.js ".modules" | sed -E "s/,/ /g"`
TS_PROJECT=`node $DEV_TOOLS_DIR/dist/helpers/get-config.js ".typescript.project"`

build_module() {
  # Build esm entry point
  (set -x; npx tspc --declaration --declarationMap --sourceMap --outDir dist --project $TS_PROJECT)

  # Build common JS entry point
  node $DEV_TOOLS_DIR/dist/build-cjs.js
}

build_monorepo() {
  while [ -n "$1" ]; do
    if [[ "$1" =~ ^\-\-[A-Za-z]+ ]]; then
      case "$1" in
        --dist)
            TARGET=$2
            shift ;;
        *)
            echo -e "\033[91mUnknown option $1. ocular-build [--dist es5|es6,...] [module1,...]\033[0m"
            exit 1 ;;
      esac
    else
      # Build selected modules
      # build.sh MODULE1,MODULE2
      MODULES=`echo $1 | sed -e 's/,/ modules\//g' | sed -e 's/^/modules\//g'`
    fi
    shift
  done

  if [ -z "$MODULES" ]; then
    # Build all modules
    MODULES=`node $DEV_TOOLS_DIR/dist/helpers/build-order.js`
  fi

  for D in ${MODULES}; do (
    if [ -e "${D}/package.json" ]; then
      echo -e "\033[1mBuilding $D\033[0m"
      cd $D
      build_module
      echo ""
    elif [ ! -e "${D}" ]; then
      echo -e "\033[1mWarning: skipping $D because it doesn't match any file.\033[0m"
      echo -e "\033[1mHint: modules must be specified using full path relative to the project root.\033[0m"
      echo ""
    fi
  ); done
}

if [ -d "modules" ]; then
  build_monorepo $*
else
  build_module
fi
