#!/bin/bash
# Automated tests

set -e

BASEDIR=$(dirname "$0")

MODE=$1

DEV_TOOLS_DIR=$(dirname $0)/..
TEST_SCRIPT=$DEV_TOOLS_DIR/dist/test.js
COVERAGE_TEST=`node $DEV_TOOLS_DIR/dist/helpers/get-config.js ".coverage.test"`

usage() {
  # TODO: Add more specific url
  open "https://uber-web.github.io/ocular/docs/dev-tools/cli/ocular-test"
}

run_test_script() {
  (set -x; NODE_ENV=test node $TEST_SCRIPT $1)
}

run_test_script_pretty() {
  run_test_script $1 | npx tap-spec
}

generate_coverage_report() {
  (set -x; npx c8 report --reporter=text --reporter=lcov)
}

run_full_test() {
  run_test_script_pretty node
  run_test_script_pretty browser-headless
}

case $MODE in
  "")
    echo "test [ 'full' | 'dist' | 'bench' | 'ci' | 'cover' | 'browser' | 'browser-headless' ]"
    echo "Running 'full' test by default"
    run_full_test
    ;;

  "full")
    run_full_test
    ;;

  "node")
    run_test_script_pretty node
    ;;

  "node-debug")
    echo "Open chrome://inspect/#devices to attach debugger."
    (set -x; node $TEST_SCRIPT node-debug)
    ;;

  "dist")
    run_test_script_pretty node dist
    run_test_script_pretty browser-headless dist
    ;;

  "cover")
    run_test_script_pretty cover
    generate_coverage_report
    ;;

  "ci")
    # run by CI
    if [ "$COVERAGE_TEST" == "browser" ]; then
      run_test_script_pretty node
    else
      run_test_script_pretty browser-headless
    fi
    run_test_script_pretty cover
    generate_coverage_report
    ;;

  "browser-headless")
    run_test_script_pretty browser-headless
    ;;

  *)
    # default test
    run_test_script $MODE
    ;;

  esac
