#!/bin/bash
# Script to bootstrap repo for development

set -e

# prepare module directories
PACKAGE_DIR=`pwd`
ROOT_NODE_MODULES_DIR=$PACKAGE_DIR/node_modules
YARN_MAJOR_VERSION=`yarn --version | cut -d. -f1`

if [ -d "modules" ]; then
  # monorepo
  cd modules
  for D in *; do (
    [ -d $D ]
    cd $D

    if [ "$YARN_MAJOR_VERSION" -eq 1 ]; then
      # Yarn 1 does not reliably expose root binaries inside workspaces.
      # Do not use this workaround with modern Yarn: sharing the root .bin directory
      # causes Yarn installs to overwrite root links with workspace-relative targets.
      mkdir -p node_modules
      rm -rf ./node_modules/.bin
      ln -sf $ROOT_NODE_MODULES_DIR/.bin ./node_modules
    elif [ -L ./node_modules/.bin ]; then
      # Remove links left by older versions of ocular-bootstrap. Yarn will recreate
      # workspace-local binary links on the next install.
      rm ./node_modules/.bin
    fi
  ); done

  cd $PACKAGE_DIR
else
  packageName=`node -e "console.log(require('./package.json').name)"`
  yarn link
  yarn link $packageName
fi
