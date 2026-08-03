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

## ocular-dev-tools 1.0.0

Functional entry points replace subpath imports
