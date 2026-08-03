# ocular-test

Run one or more Vitest projects through the shared compatibility command.

```bash
ocular-test <project...> [vitest options]
```

For example:

```bash
ocular-test node headless --coverage
```

is equivalent to:

```bash
vitest run --project node --project headless --coverage
```
