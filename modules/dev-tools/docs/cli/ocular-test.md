# ocular-test

Run tests.

## Usage

This script will usually be mapped to `test`:
```bash
yarn test [mode]
```

To run it directly
```bash
npx ocular-test [mode]
```

## Modes

- `full` (default) - run unit tests in node and headless browser from source code
- `dist` - run unit tests in node and headless browser from transpiled code
- `cover` - run unit tests and generate coverage report
- `ci` - run coverage tests and report result to coveralls
- `node` - run unit tests in node
- `node-debug` - run unit tests in node debugger
- `browser` - run unit tests in browser (kept open for debugging)
- `browser-headless` - run unit tests in headless browser
- `bench` - run benchmarks in node
- `bench-browser` - run benchmarks in browser (kept open for debugging)
- other - custom mode:
  + If -browser is in the mode name, run in browser, otherwise run in node
  + If -browser-headless is in the mode name, run in headless browser
  + The rest of the name is used to look up the entry point from the entry config.

## Configuration

[Configurations](#ocular-dev-tools-1): `aliases`, `entry`
