# ocular-lint

Format and lint JavaScript and TypeScript with Biome.

```bash
ocular-lint [mode]
```

## Modes

- `full` (default) - run on all configured paths.
- `pre-commit` - only run on changed files since the last commit.
- `fix` - apply Biome's safe lint fixes and formatting changes.

## Configuration

[Configurations](#ocular-dev-tools-1): `lint`

`ocular-lint` loads `biome.json` or `biome.jsonc` from the project root. If neither exists, it
uses the configuration shipped by `@vis.gl/dev-tools`.
