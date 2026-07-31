# Upgrade Guide

## @vis.gl/dev-tools 2.0.0

`ocular-lint` now uses Biome for both formatting and linting. Remove project ESLint and Prettier
configuration and add a root `biome.jsonc` that extends `@vis.gl/dev-tools/biome.jsonc`.

The `getESLintConfig` and `getPrettierConfig` exports have been removed. Biome configuration is
shared as JSON instead of through JavaScript configuration builders.

## ocular-dev-tools 1.0.0

Functional entry points replace subpath imports
