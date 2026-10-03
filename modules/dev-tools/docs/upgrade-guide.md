# Upgrade Guide

## @vis.gl/dev-tools 2.0.0

`ocular-lint` now uses Biome for both formatting and linting. Remove project ESLint and Prettier
configuration and add a root `biome.jsonc` that extends `@vis.gl/dev-tools/biome.jsonc`.

The `getESLintConfig` and `getPrettierConfig` exports have been removed. Biome configuration is
shared as JSON instead of through JavaScript configuration builders.

The Tape-based runner has been removed. Add a root `vitest.config.ts` using `getVitestConfig()`
and use `*.node.spec.ts` for Node tests and `*.browser.spec.ts` for Playwright browser tests.
`ocular-test <project>` remains as a thin wrapper around `vitest run --project <project>`.
Pass a `projects` map to `getVitestConfig()` to customize, disable, or add projects. The legacy
`node`, `browser`, and `headless` test-option fields remain temporarily available but are deprecated.

### Vitest 5

Update `vitest` and any directly installed `@vitest/*` providers to matching Vitest 5 versions.
Vitest 4 is no longer supported by this version of the shared configuration. Yarn users must
also install `vite` explicitly; it is now a required peer dependency. Vite 6.4, 7, and 8 are supported.

Vitest 5 clears mock call history before each test and fails unawaited asynchronous assertions.
Review tests that inspect calls made in `beforeAll`, and await `resolves`, `rejects`, and other
asynchronous expectations. Coverage globs now match relative paths more precisely: compare the
covered file inventory and retain newly included production files instead of weakening thresholds.

Blob reports now default to `.vitest/blob/`. Update CI artifact paths, or retain existing paths
with explicit, unique `--outputFile.blob` values for each shard and a matching `--merge-reports`
directory. Add `.vitest/` to the consuming repository's `.gitignore` for generated artifacts.

See the [Vitest 5 migration guide](https://vitest.dev/guide/migration/) for the complete changes.

## ocular-dev-tools 1.0.0

Functional entry points replace subpath imports
