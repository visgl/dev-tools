# @vis.gl/dev-tools

Shared build, lint, test, bundle, metrics, and publishing tools for vis.gl repositories.

Version 2 uses Biome for linting and formatting and Vitest with Playwright for Node and browser
tests. It supports both single-package repositories with source under `src/` and monorepos with
packages under `modules/`.

## Requirements

- Node.js 22 or newer
- A root `.ocularrc.js`, `.ocularrc.cjs`, `.ocular.config.js`, or `.ocular.config.cjs` for commands
  that load repository configuration
- A root `vitest.config.ts` when using `ocular-test`

## Installation

Install dev-tools together with its required peers:

```bash
yarn add --dev @vis.gl/dev-tools vitest playwright
```

If the repository collects coverage, also install the V8 coverage provider:

```bash
yarn add --dev @vitest/coverage-v8
```

Keep `vitest`, `@vitest/coverage-v8`, and any directly installed `@vitest/*` browser packages on
compatible versions. Vitest packages use strict peer relationships and should resolve to the same
Vitest release.

Install the browser binaries that the repository tests against. For the default Chromium setup:

```bash
yarn playwright install chromium
```

### Why these packages are peers

`@vis.gl/dev-tools` declares the following peer dependencies so that test plugins resolve from the
consumer repository and use one compatible runtime:

- `vitest` is required. Test configuration files import Vitest types and configuration APIs, and
  `ocular-test` runs the consumer's Vitest installation.
- `playwright` is required by the Playwright-backed browser projects. Keeping it in the consumer
  lets each repository control the Playwright version and browser installation lifecycle.
- `@vitest/coverage-v8` is optional. Vitest loads the selected coverage provider dynamically from
  the consumer project when `--coverage` is enabled. A copy nested inside dev-tools is not reliably
  resolvable, particularly with Yarn v1. Repositories that do not collect coverage can omit it.

The default coverage provider is V8, but coverage itself is disabled until the consumer passes
`--coverage` or enables it in Vitest configuration. A repository that selects Istanbul instead must
install `@vitest/coverage-istanbul` directly.

## Package scripts

A typical root `package.json` uses the CLIs directly:

```json
{
  "scripts": {
    "bootstrap": "yarn && ocular-bootstrap",
    "clean": "ocular-clean",
    "build": "ocular-clean && ocular-build",
    "lint": "ocular-lint",
    "lint:fix": "ocular-lint fix",
    "test": "ocular-test node headless",
    "test:browser": "ocular-test browser",
    "test:coverage": "ocular-test node headless --coverage",
    "metrics": "ocular-metrics",
    "publish:beta": "ocular-publish beta"
  }
}
```

## Configuration patterns

Dev-tools uses three complementary root configuration files:

- `.ocularrc.js` describes repository layout, build aliases, bundles, lint roots, and metrics entry
  points.
- `biome.jsonc` selects files and customizes lint and formatting policy.
- `vitest.config.ts` defines test projects and test-specific aliases and options.

### Ocular configuration

For an ESM repository, create `.ocularrc.js`:

```js
/** @type {import('@vis.gl/dev-tools').OcularConfig} */
const config = {
  lint: {
    paths: ['modules', 'test', 'examples']
  },
  typescript: {
    project: 'tsconfig.json'
  },
  aliases: {
    'project-test': './test'
  },
  nodeAliases: {
    'project-test/node': './test/node'
  },
  bundle: {
    target: ['chrome110', 'firefox110', 'safari15'],
    format: 'umd',
    globalName: 'project',
    externals: ['react'],
    globals: {
      react: 'globalThis.React'
    }
  },
  entry: {
    size: ['test/size/import-nothing.js', 'test/size/import-all.js']
  }
};

export default config;
```

For a CommonJS repository, use `.ocularrc.cjs` and export the same object with
`module.exports = config`.

The supported fields are:

| Field | Purpose | Default |
| --- | --- | --- |
| `aliases` | Additional module aliases used by build tools. Workspace package aliases are generated automatically. | `{}` |
| `nodeAliases` | Additional aliases used for Node-oriented builds. | `{}` |
| `bundle.target` | esbuild browser targets. | `['esnext']` in the bundle command |
| `bundle.globalName` | Global assigned by IIFE or UMD output. | unset |
| `bundle.format` | `cjs`, `esm`, `umd`, or `iife`. | `iife` |
| `bundle.externals` | Packages to leave external in addition to package peer dependencies. | `[]` |
| `bundle.globals` | Package-name patterns mapped to browser global expressions. | `{}` |
| `typescript.project` | TypeScript project used by `ocular-build`. | `tsconfig.json` |
| `lint.paths` | Root paths passed to Biome. | `['modules']` for a monorepo, otherwise `['src']` |
| `lint.extensions` | Extension metadata retained in the resolved ocular configuration. Use Biome includes to control current lint file selection. | JavaScript and TypeScript extensions |
| `entry.size` | One or more bundle entry points measured by `ocular-metrics`. | `['test/size.ts']` |

`getOcularConfig({root, aliasMode})` is exported for tools that need the fully materialized
configuration. `aliasMode` may be `src` or `dist`.

### Biome configuration

`ocular-lint` looks for `biome.json` and then `biome.jsonc` in the repository root. Extend the
shared defaults and express repository-specific file selection and rule compatibility locally:

```jsonc
{
  "$schema": "https://biomejs.dev/schemas/2.4.8/schema.json",
  "extends": ["@vis.gl/dev-tools/biome.jsonc"],
  "formatter": {
    "includes": ["modules/**/*.{js,jsx,ts,tsx}", "test/**/*.{js,ts}"]
  },
  "linter": {
    "includes": ["modules/**/*.{js,jsx,ts,tsx}"],
    "rules": {
      "suspicious": {
        "noConsole": "warn"
      }
    }
  },
  "javascript": {
    "globals": ["__VERSION__"]
  }
}
```

Keeping formatter and linter includes separate is useful when tests should be formatted but were
not part of the repository's previous lint scope. Repository-specific globals and compatibility
exceptions belong in the consumer configuration rather than the shared defaults.

If neither Biome file exists, `ocular-lint` uses the configuration packaged with dev-tools.

### Vitest configuration

Create `vitest.config.ts` at the repository root:

```ts
import {getVitestConfig} from '@vis.gl/dev-tools';

export default getVitestConfig();
```

This creates three projects:

| Project | Environment | Default files |
| --- | --- | --- |
| `node` | Node.js | `modules/**/*.node.spec.{ts,js}`, `test/**/*.node.spec.{ts,js}` |
| `browser` | Playwright, headed | `modules/**/*.browser.spec.{ts,js}`, `test/**/*.browser.spec.{ts,js}` |
| `headless` | Playwright, headless | `modules/**/*.browser.spec.{ts,js}`, `test/**/*.browser.spec.{ts,js}` |

Path aliases are read from `compilerOptions.paths` in the root `tsconfig.json`. Use
`tsconfigProjects` when aliases are spread across multiple TypeScript projects:

```ts
export default getVitestConfig({
  tsconfigProjects: ['./tsconfig.json', './test/tsconfig.json']
});
```

Customize a built-in project, disable one, or add a project with the `projects` map:

```ts
export default getVitestConfig({
  excludePatterns: ['test/fixtures/**'],
  testTimeout: 30_000,
  browserName: 'chromium',
  launchOptions: {
    args: ['--use-angle=swiftshader']
  },
  projects: {
    node: {
      test: {
        include: ['test/**/*.node.spec.ts']
      }
    },
    browser: false,
    render: {
      test: {
        include: ['test/render/**/*.spec.ts'],
        sequence: {groupOrder: 3}
      }
    }
  }
});
```

Project objects are deeply merged with a same-named default. Arrays replace default arrays. A
custom map key becomes the project name unless `test.name` is set explicitly. Set a project to
`false` to remove it.

Coverage defaults to the V8 provider with `text` and `lcov` reporters. Override coverage options
without replacing the rest of the shared test setup:

```ts
export default getVitestConfig({
  coverage: {
    provider: 'v8',
    include: ['modules/*/src/**/*.ts'],
    exclude: ['modules/test-utils/**']
  }
});
```

The complete `getVitestConfig` options are:

| Option | Purpose |
| --- | --- |
| `tsconfigProjects` | TypeScript projects whose path aliases are exposed to Vite. |
| `overrides` | Additional root-level Vite configuration. |
| `excludePatterns` | Patterns excluded from every default test project. |
| `browserName` | Default Playwright browser: `chromium`, `firefox`, or `webkit`. |
| `testTimeout` | Default timeout for the built-in projects. |
| `launchOptions` | Playwright launch options shared by headed and headless projects. |
| `coverage` | Vitest coverage options merged over the V8 defaults. |
| `projects` | Built-in overrides, disabled projects, and arbitrary custom projects. |

The legacy `node`, `browser`, and `headless` fields are deprecated. Put their test options under
`projects.<name>.test` instead.

## CLI reference

### `ocular-bootstrap`

```bash
ocular-bootstrap
```

For monorepos, creates each module's `node_modules` directory and links its `.bin` directory to the
root binaries. In a single-package repository, it sets up the package through Yarn link. Run the
repository's package-manager install before this command.

### `ocular-build`

```bash
ocular-build [module1,module2] [--dist target]
```

Builds TypeScript declarations, JavaScript, source maps, and CommonJS export entries. With no
module list, a monorepo is built in dependency order. A comma-separated list limits the build to
the named directories under `modules/`. `--dist` is accepted for backward compatibility; the
current compiler output is controlled by the TypeScript project and package exports.

### `ocular-clean`

```bash
ocular-clean [all]
```

Without an argument, removes and recreates each `dist` directory. With `all`, removes each `dist`
directory without recreating it. Both modes remove `tsconfig.tsbuildinfo` files.

### `ocular-lint`

```bash
ocular-lint [fix | pre-commit | help] [Biome options]
```

- With no mode, checks all existing paths from `.ocularrc.js` without writing files.
- `fix` passes `--write` to Biome, applying formatting and safe fixes.
- `pre-commit` checks existing tracked files reported by `git diff HEAD` within configured lint
  paths.
- `help` prints command usage.
- Additional arguments are forwarded to `biome check`, for example
  `ocular-lint --formatter-enabled=false` or `ocular-lint fix --unsafe`.

After Biome, the command also rejects a Yarn lockfile containing the non-public `unpm.u` registry.

### `ocular-test`

```bash
ocular-test <project...> [Vitest options]
```

All project names must precede the first option. Each name becomes a Vitest `--project` argument;
remaining options are forwarded to `vitest run`:

```bash
ocular-test node headless --coverage --reporter=verbose
```

is equivalent to:

```bash
vitest run --project node --project headless --coverage --reporter=verbose
```

Use `ocular-test --help` for the short usage string and Vitest's documentation for forwarded
options.

### `ocular-bundle`

```bash
ocular-bundle <entry.js|entry.ts> [options]
```

Builds a standalone browser bundle with esbuild. Recognized options are:

| Option | Description |
| --- | --- |
| `--env=dev\|prod` | Development uses source aliases, disables minification, and defaults to `dist/dist.dev.js`; production uses dist aliases, minifies, and defaults to `dist.min.js`. |
| `--output=<path>` | Output file. |
| `--format=iife\|umd\|esm\|cjs` | Bundle format. |
| `--target=<target>` | esbuild target. |
| `--externals=a,b` | Additional external packages. Package peer dependencies are external automatically. |
| `--globalName=<name>` | Browser global for IIFE or UMD output. |
| `--sourcemap` | Generate a source map. |
| `--debug` | Print the resolved esbuild configuration. |
| `--watch` | Request watch mode. |

Package-to-global mappings for IIFE and UMD bundles are configured through
`bundle.globals` in `.ocularrc.js`.

### `ocular-metrics`

```bash
ocular-metrics
```

Bundles every `entry.size` target twice, reports minified and gzip sizes for ES5-style and ESM
resolution, and removes its temporary output afterward. The command reserves a root `tmp`
directory while it runs; do not store project files there.

### `ocular-bump`

```bash
ocular-bump <package>[=latest|beta|version] [...packages]
```

Uses npm search and dist-tags to find matching packages, then updates matching `dependencies`,
`devDependencies`, and `peerDependencies` in package manifests throughout the repository. Run the
package manager afterward to refresh the lockfile.

Examples:

```bash
ocular-bump luma.gl
ocular-bump deck.gl=beta luma.gl=beta
ocular-bump math.gl=4.1.0
```

### `ocular-publish`

```bash
ocular-publish <beta|prod|version-only-beta|version-only-prod|from-git>
```

| Mode | Behavior |
| --- | --- |
| `beta` | Bump a prerelease version, validate and push it, then publish. |
| `prod` | Bump a patch version, validate and push it, then publish. |
| `version-only-beta` | Perform only the prerelease version and Git steps. |
| `version-only-prod` | Perform only the patch version and Git steps. |
| `from-git` | Publish package versions already represented by the current Git state. |

Version modes require a clean working tree and a matching changelog entry. Publishing creates a
GitHub release when possible and selects the npm dist-tag from the package version. This command
changes package versions, Git commits/tags, remote branches, and npm state; run it only from a
reviewed release checkout.

## ESM repositories

For native ESM:

- Add `"type": "module"` to the root and workspace package manifests.
- Set `compilerOptions.module` to an ESM-compatible value such as `esnext`.
- Use `.cjs` for configuration files that still require CommonJS.
- Include file extensions in relative imports emitted for Node.js, for example `./init.js`.

Additional migration notes and focused CLI pages are available in the [`docs`](./docs) directory.
