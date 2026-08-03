# ocular-dev-tools

Dev tools for vis.gl open source Javascript frameworks

Contains developer targets for building, cleaning, linting, testing and publishing frameworks.

* The Vitest configuration helper supports Node and Playwright-backed browser tests.
* The linting feature uses Biome to format and lint JavaScript and TypeScript.
* Supports both single module repos (all code in src) and monorepos (code in `modules/<module-name>/src`).

Note: flow is not currently integrated into ocular-dev-tools as we restrict its use to React related code bases.

## Covered tools

ocular installs the necessary dependencies and provides working default configurations for

- Biome
- Vitest
- Playwright
- Vite

Note that this list may grow over time.

## Installation

```bash
yarn add ocular-dev-tools
```

Your `package.json` should looks something like:

```json
  "devDependencies": {
    "@vis.gl/dev-tools": "^2.0.0"
  }
```

After installing you can set up your build scripts in package.json as follows:

```json
  "scripts": {
    "bootstrap": "yarn & ocular-bootstrap",
    "build": "ocular-clean && ocular-build",
    "lint": "ocular-lint",
    "metrics": "ocular-metrics",
    "publish": "ocular-publish",
    "test": "ocular-test node",
    "test-headless": "ocular-test headless"
  },
```

## Usage

### Command Line Tools

| Typical Build Script | Ocular Script | Description |
| --- | --- | --- |
| [`ocular-bootstrap`](docs/dev-tools/cli/ocular-bootstrap) | `bootstrap` | Install dependencies for monorepos |
| [`ocular-clean`](docs/dev-tools/cli/ocular-clean) | `clean` | Remove all transpiled files in preparation for a new build. |
| [`ocular-build`](docs/dev-tools/cli/ocular-build) | `build` | Transpile all modules. |
| [`ocular-lint`](docs/dev-tools/cli/ocular-lint) | `lint` | Format and lint the code base with Biome. |
| [`ocular-test`](docs/dev-tools/cli/ocular-test) | `test` | Run a named Vitest project. |
| [`ocular-metrics`](docs/dev-tools/cli/ocular-metrics) | `metrics` | Bundle the source and report the bundle size. |
| [`ocular-publish`](docs/dev-tools/cli/ocular-publish) | `publish` | Publish the packages, create git tag and push. |


### Configuration

To provide maximum control to the user, ocular build scripts use config files in the framework repo. In cases where such files allow for importing other templates, ocular provides exports that can be used, if not it provides a template that the user can copy into the frameworks root directory.

#### .ocularrc.js

A file `.ocularrc.js` can be placed at the root of the package to customize the dev scripts. The config file may export a JSON object that contains the following keys, or a callback function that returns such object:

- `esm` (Boolean) - set if tests should run using Node.js's ES module resolution. By default `true` if and only if `type: "module"` is found in the root package.json.
- `lint` - options to control Biome's target paths
  + `paths` (Arrray) - directories to include when linting. Default `['modules', 'src']`
- `aliases` (Object) - Module aliases used by build tools.
- `nodeAliases` (Object) - Module aliases used by Node build tools.
- `typescript`
  + `project` (String) - path to the project's tsconfig
- `bundle` - options to control esbuild behavior
  + `target` (String)
  + `globalName` (String)
  + `format` (String) - one of `cjs`, `esm`, `umd`, `iife`
  + `externals` (String[])
  + `globals` (Object) - import package from global variable.
- `entry` (Object) - entry points for build utilities.
  + `size` (String | String[]) - metrics entry point(s). Can be a `.js` or `.ts` file. Default `./test/size.ts`.


#### Biome

`ocular-lint` uses `biome.json` or `biome.jsonc` at the project root when present. A project may
extend the shared vis.gl defaults and add repository-specific file selection and rule overrides:

```jsonc
{
  "$schema": "https://biomejs.dev/schemas/2.4.8/schema.json",
  "extends": ["@vis.gl/dev-tools/biome.jsonc"],
  "files": {
    "includes": ["modules/**/*.js", "modules/**/*.ts", "test/**/*.ts"]
  }
}
```

When no project configuration exists, `ocular-lint` uses the packaged defaults directly.
#### vite

Create `vitest.config.ts` at the repository root and call `getVitestConfig()` for shared Node,
headed-browser, and headless-browser projects. Node-only tests use `*.node.spec.ts`; browser tests
use `*.browser.spec.ts`.

```ts
import {getVitestConfig} from '@vis.gl/dev-tools';

export default getVitestConfig();
```

Customize a built-in project, disable one, or add arbitrary local projects with the `projects` map.
Project configuration is deeply merged with a same-named default; arrays replace default arrays.

```ts
export default getVitestConfig({
  projects: {
    node: {test: {include: ['modules/**/*.spec.ts']}},
    browser: false,
    render: {
      test: {include: ['test/render/**/*.spec.ts']}
    }
  }
});
```

The map key becomes the project's Vitest name unless `test.name` is explicitly set. Custom projects
may use any project-level Vitest options, including `resolve`, `optimizeDeps`, and `server`.


## ESM Repo

ocular-dev-tools v2.0 can be used in a ESM repo. When enabled, all imports/exports are handled with Node.js's native [ESM](https://nodejs.org/api/esm.html#introduction) support, instead of being transpiled to commonjs.

To enable ESM mode:

- Add `type: 'module'` to the root `package.json` and each submodule's `package.json`s.
- Add `compilerOptions.module: 'esnext'` to `tsconfig.json`.
- ES5-style `require()` and `module.exports` must be removed from all `.js` files. Dependencies that do not support ESM syntax may still require `.cjs` configuration files.
- When importing directly from a non-TypeScript file, the file extension must be specified. E.g. `import './init'` now becomes `import './init.js'`.
