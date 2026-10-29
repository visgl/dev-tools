# ocular-build

Build each package's ESM files and declarations, then its CommonJS exports.

## TypeScript 7

Install TypeScript 7 in the consuming repository and select the native build in
`.ocularrc.js`:

```js
export default {
  typescript: {
    project: 'tsconfig.json',
    compiler: 'native'
  }
};
```

The default remains `compiler: 'patched'`, using `tspc`. Native builds resolve the
`typescript` executable from the consuming package, require version 7 or newer,
and do not patch the native compiler. Dev-tools retains TypeScript 6 internally
for configuration and syntax parsing; it does not use it to type-check or emit
native builds.

Keep extensionless imports in your source and retain these existing `tsconfig.json`
plugin entries:

```json
{
  "compilerOptions": {
    "plugins": [
      {"transform": "@vis.gl/ts-plugins/ts-transform-version-inline"},
      {"transform": "@vis.gl/ts-plugins/ts-transform-inline-webgl-constants"},
      {"transform": "@vis.gl/ts-plugins/ts-transform-remove-glsl-comments"},
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

After a successful native compilation, dev-tools applies the following output
transforms before generating CommonJS exports:

- Replace `__VERSION__` (or the configured `identifier`) using the nearest source
  package's `package.json` version.
- Inline known `GL.CONSTANT`, `gl.CONSTANT`, and string-indexed WebGL constants.
  The values come from `@luma.gl/constants`. The repository-local
  `@luma.gl/ts-transform-inline-webgl-constants` entry is also recognized and uses
  luma.gl's bootstrapped `modules/core/dist/webgl-constants/index.cjs` when present.
  To use another constants-only CommonJS module exporting `GL`, set the plugin's
  `constantsModule` to a package name or a path relative to the selected tsconfig.
- Strip GLSL comments and excess line whitespace in `glsl` tagged templates and
  templates selected by the plugin's `pattern` globs. Interpolations remain intact.
- Append configured extensions to relative imports, re-exports, and literal
  dynamic imports in JavaScript, and to module references in declarations,
  including `import('./module').Type`. Package imports and other strings remain
  untouched. The declaration pass requires `afterDeclarations: true`.

Edits are composed with the compiler's JavaScript and declaration source maps.
Source files are never rewritten. Native builds currently re-emit the selected
package in full, overriding `incremental` and `composite` for that invocation to
avoid post-processing already transformed output on an incremental rebuild.
Project references still require their dependencies to have been built first,
following the normal ocular package build order.

Unsupported transformer entries fail explicitly, including `ts-transform-webgpu`;
they are not silently ignored. This path supports the four transformers used in
luma.gl, rather than arbitrary `ts-patch` plugins. The rest of the consuming
repository's compiler options must also be compatible with TypeScript 7 (for
example, use a supported module resolution mode).
