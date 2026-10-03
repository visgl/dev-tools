# WebGPU transform

`@vis.gl/ts-plugins/ts-transform-webgpu` produces either WebGPU-enabled JavaScript or a
WebGL-only variant from the same TypeScript sources. WebGL-only builds replace WebGPU-specific
expressions with constants and stubs so that downstream minifiers and tree-shakers can remove
unreachable code and shader sources.

## Configuration

Add the transform to `compilerOptions.plugins`:

```json
{
  "compilerOptions": {
    "plugins": [
      {
        "transform": "@vis.gl/ts-plugins/ts-transform-webgpu",
        "webGPUEnabled": false
      }
    ]
  }
}
```

`webGPUEnabled` defaults to `false`. Set it to `true` for a full WebGPU-enabled build and to
`false` for a WebGL-only build.

## Transformations

The identifier `__WEBGPU_ENABLED` is replaced with the configured boolean:

```ts
const isWebGPUEnabled = __WEBGPU_ENABLED;
```

When `webGPUEnabled` is `false`, the transform also:

- Replaces `device.type === 'webgpu'` and `<expression>.device.type === 'webgpu'` with `false`.
- Replaces template literals immediately preceded by `/* wgsl */` with `null`, including
  interpolated templates.
- Rewrites JavaScript values exported from files ending in `.wgsl.ts`. Exported variables become
  `null`, and exported functions become `() => null`. Exported type aliases and interfaces remain
  available to TypeScript declaration emit.

For example:

```ts
const source = /* wgsl */ `
  @vertex fn main() {}
`;

const backend = device.type === 'webgpu' ? webgpuBackend : webglBackend;
```

becomes:

```ts
const source = null;
const backend = webglBackend;
```

The transform folds conditional expressions whose condition is a literal boolean. It also folds
conditions that reference a `const` initialized directly to `true` or `false`:

```ts
const isWebGPU = false;
const backend = isWebGPU ? webgpuBackend : webglBackend;
```

becomes:

```ts
const isWebGPU = false;
const backend = webglBackend;
```

## Scope

This transform operates during TypeScript JavaScript emit. It does not change application runtime
feature detection, package exports, declaration routing, or bundler configuration. Build tooling is
responsible for selecting `webGPUEnabled`, placing each output in the appropriate package
directory, and exposing it through package metadata.
