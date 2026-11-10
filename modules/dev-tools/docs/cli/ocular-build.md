# ocular-build

Build each package's ESM files and declarations, then its CommonJS exports.

## TypeScript 7

Install TypeScript 7 in the consuming repository and select the native compiler
in `.ocularrc.js`:

```js
export default {
  typescript: {project: 'tsconfig.json', compiler: 'native'}
};
```

The default `compiler: 'patched'` uses `tspc`. Unknown compiler names fail.
Native builds resolve TypeScript 7 from the consuming package. Dev-tools retains
TypeScript 6 internally for configuration and output-path helpers, while checking
and emission use the consumer's native compiler.

### Extensionless imports in any framework

For a framework that only needs extensionless imports, keep the source unchanged
and configure the two output passes in its tsconfig:

```json
{
  "compilerOptions": {
    "plugins": [
      {
        "transform": "@vis.gl/ts-plugins/ts-transform-append-extension",
        "extensions": [".js"],
        "after": true
      },
      {
        "transform": "@vis.gl/ts-plugins/ts-transform-append-extension",
        "extensions": [".js"],
        "afterDeclarations": true
      }
    ]
  }
}
```

Native builds read these entries as standalone output transforms, without loading
or patching the native compiler. Each transform is optional. A package with no
plugins performs a normal native compilation and CommonJS build. Monorepos use
the usual ocular package order; each package's selected tsconfig determines its
transforms. Import rewriting and version injection do not resolve constants tables or depend
on a consumer repository layout. The plugin package retains its existing standard
WebGL constants dependency for consumers selecting that optional transform.

The extension transform handles relative imports, re-exports, literal dynamic
imports, and declaration module references such as `import('./module').Type`.
Package imports and unrelated strings remain intact. `extensions` also supports
suffix mappings such as `.lib.cjs`. Configure `afterDeclarations` explicitly for
declaration references.

### Optional version and shader transforms

Add any of these entries to the same plugin array as needed:

```json
{"transform": "@vis.gl/ts-plugins/ts-transform-version-inline", "identifier": "__VERSION__"}
```

This replaces the configured identifier using the nearest source package's
`package.json`. It also supports shorthand properties such as `{__VERSION__}`.
Different packages in a monorepo retain their own versions.

```json
{"transform": "@vis.gl/ts-plugins/ts-transform-remove-glsl-comments", "pattern": ["src/**/*.glsl.ts"]}
```

This cleans shader comments and excess line whitespace inside `glsl` tagged
templates and templates selected by `pattern`. Interpolations remain intact.

```json
{
  "transform": "@vis.gl/ts-plugins/ts-transform-inline-webgl-constants",
  "constantsModule": "./build/constants.cjs",
  "pruneImports": true
}
```

The native adapter replaces known numeric `GL.CONSTANT`, `gl.CONSTANT`, and
string-indexed constants. `constantsModule` may be a package name or a file path
relative to the tsconfig and must export a `GL` table. If omitted, the shared
plugin package's `@luma.gl/constants` dependency supplies the standard WebGL table.
Enum reverse mappings remain unchanged. Unused named imports from known constants
modules are pruned; set `pruneImports: false` to keep them.

There is no special handling for luma.gl's repository layout. A consumer using
its own bootstrapped constants must configure that module explicitly. Legacy
plugin prefixes are recognized by transform basename, consistently across lookup
and pruning. Repository-local plugins with that basename must use these explicit
options to select different behavior. `constantsModule` and `pruneImports` are shared options supported by both the
native adapter and the patched WebGL plugin.

### Packaging and limitations

Standalone transforms live in `@vis.gl/ts-plugins/output-transforms`, with shared
version, extension, GLSL cleanup, and constants-module rules also used by the
patched plugin implementations. The compiler runner only orchestrates compilation,
output processing, and source-map composition.

Edits compose with JavaScript and declaration source maps. The compiler's emitted
file list includes separate `declarationDir` output; source filenames come from
compiler inputs, so debugger-only `sourceRoot` URLs do not affect transforms.
Source files are never rewritten.

Native builds currently re-emit the selected package in full, overriding
`incremental` and `composite` for that invocation to avoid transforming previously
processed output again. Referenced dependencies must be built first. `outFile`
is unsupported. Other compiler options must be compatible with TypeScript 7.
Unsupported transformers, including `ts-transform-webgpu`, fail explicitly rather
than being ignored. Supporting the four shared output transforms does not imply
support for arbitrary ts-patch plugins.
