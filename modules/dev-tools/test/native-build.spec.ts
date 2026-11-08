import {expect, test} from 'vitest';
import {execFileSync, spawnSync} from 'node:child_process';
import {mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, symlinkSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {transformOutput, loadConstants} from '@vis.gl/ts-plugins/output-transforms';

const plugins = [
  {transform: '@vis.gl/ts-plugins/ts-transform-version-inline'},
  {transform: '@luma.gl/ts-transform-inline-webgl-constants', constantsModule: './constants.cjs'},
  {transform: '@vis.gl/ts-plugins/ts-transform-remove-glsl-comments'},
  {transform: '@vis.gl/ts-plugins/ts-transform-append-extension', after: true},
  {transform: '@vis.gl/ts-plugins/ts-transform-append-extension', afterDeclarations: true}
];

test('output rewrites only module references, including declaration import types', () => {
  const code = `import x from './x'; export * from '../y'; import('./lazy'); import('external'); const text = './text'; import './existing.js';`;
  const result = transformOutput(code, '/project/dist/index.js', plugins).code;
  expect(result).toContain("from './x.js'");
  expect(result).toContain("from '../y.js'");
  expect(result).toContain("import('./lazy.js')");
  expect(result).toContain("import('external')");
  expect(result).toContain("const text = './text'");
  expect(result).toContain("import './existing.js'");
  expect(
    transformOutput(
      `export type X = import('./x').X; export * from './x';`,
      '/project/dist/index.d.ts',
      plugins
    ).code
  ).toBe(`export type X = import('./x.js').X; export * from './x.js';`);
});

test('shader templates preserve interpolation and untagged strings', () => {
  const input =
    'const s = glsl`// comment\nfloat x = ${value}; /* block */\n`; const plain = `// keep\n`;';
  expect(transformOutput(input, '/project/index.js', plugins).code).toBe(
    'const s = `\nfloat x = ${value};\n`; const plain = `// keep\n`;'
  );
  const patterned = [
    {transform: '@vis.gl/ts-plugins/ts-transform-remove-glsl-comments', pattern: ['**/*.glsl.ts']}
  ];
  expect(
    transformOutput(
      'const s = `/* remove */\nvoid main() {}`;',
      '/project/shader.js',
      patterned,
      {},
      path.resolve('shader.glsl.ts')
    ).code
  ).not.toContain('remove');
});

test('WebGL constants support both access forms without replacing strings or unknown values', () => {
  const input = 'GL.TRIANGLES + gl["TRIANGLES"] + GL.UNKNOWN; const s = "GL.TRIANGLES";';
  expect(transformOutput(input, '/project/index.js', plugins, {TRIANGLES: 4}).code).toBe(
    '4 + 4 + GL.UNKNOWN; const s = "GL.TRIANGLES";'
  );
});

test.each([
  false,
  true
])('native compiler preserves all transforms with custom output paths: %s', (customPaths) => {
  const directory = mkdtempSync(path.join(tmpdir(), 'ocular-native-'));
  const require = createRequire(import.meta.url);
  try {
    mkdirSync(path.join(directory, 'node_modules'));
    symlinkSync(
      path.dirname(require.resolve('typescript-native/package.json')),
      path.join(directory, 'node_modules/typescript'),
      'junction'
    );
    mkdirSync(path.join(directory, 'src'));
    writeFileSync(
      path.join(directory, 'package.json'),
      JSON.stringify({name: 'fixture', type: 'module', version: '1.2.3'})
    );
    writeFileSync(path.join(directory, 'constants.cjs'), 'exports.GL = {TRIANGLES: 4};');
    writeFileSync(
      path.join(directory, 'tsconfig.json'),
      JSON.stringify({
        compilerOptions: {
          target: 'esnext',
          module: 'esnext',
          moduleResolution: 'bundler',
          composite: true,
          rootDir: 'src',
          types: [],
          plugins: plugins.map((plugin) =>
            plugin.transform.endsWith('ts-transform-remove-glsl-comments')
              ? {...plugin, pattern: ['src/*.glsl.ts']}
              : plugin
          ),
          ...(customPaths
            ? {declarationDir: 'types', sourceRoot: 'https://debugger.invalid/source/'}
            : {})
        },
        ...(customPaths ? {files: ['src/index.ts', 'src/shader.glsl.ts']} : {include: ['src']})
      })
    );
    const source = `declare const __VERSION__: string;
declare const GL: {TRIANGLES: number};
declare function glsl(strings: TemplateStringsArray, ...values: unknown[]): string;
export {value} from './value';
export const version = __VERSION__;
export const mode = GL.TRIANGLES;
export const modeText = GL.TRIANGLES.toString(16);
export const shader = glsl\`// comment
void main() { /* remove */ }
\`;
export const load = () => import('./value');
export type Value = import('./value').Value;
export function crash() { throw new Error('source-map-fixture'); }
`;
    writeFileSync(path.join(directory, 'src/index.ts'), source);
    writeFileSync(
      path.join(directory, 'src/shader.glsl.ts'),
      'export const shader = `/* strip-pattern */\nvoid main() {}`;'
    );
    writeFileSync(
      path.join(directory, 'src/value.ts'),
      'export const value = 42; export type Value = number;'
    );
    writeFileSync(
      path.join(directory, '.ocularrc.js'),
      `export default {typescript: {project: 'tsconfig.json', compiler: 'native'}};`
    );
    const cli = fileURLToPath(new URL('../scripts/build.sh', import.meta.url));
    const run = () => execFileSync('bash', [cli], {cwd: directory, encoding: 'utf8'});
    run();
    const js = readFileSync(path.join(directory, 'dist/index.js'), 'utf8');
    expect(js).toContain('"1.2.3"');
    expect(js).toContain('mode = 4');
    expect(js).toContain("from './value.js'");
    expect(js).toContain("import('./value.js')");
    expect(js).not.toContain('glsl`');
    expect(js).not.toContain('/* remove */');
    const declarations = customPaths ? 'types' : 'dist';
    expect(readFileSync(path.join(directory, 'dist/shader.glsl.js'), 'utf8')).not.toContain(
      'strip-pattern'
    );
    expect(readFileSync(path.join(directory, declarations, 'index.d.ts'), 'utf8')).toContain(
      "import('./value.js')"
    );
    for (const name of ['dist/index.js.map', `${declarations}/index.d.ts.map`]) {
      const map = JSON.parse(readFileSync(path.join(directory, name), 'utf8'));
      expect(map.sources).toEqual([
        customPaths ? 'https://debugger.invalid/source/index.ts' : '../src/index.ts'
      ]);
      expect(map.mappings.length).toBeGreaterThan(0);
    }
    const commonjs = require(path.join(directory, 'dist/index.cjs'));
    expect(commonjs.version).toBe('1.2.3');
    expect(commonjs.mode).toBe(4);
    expect(commonjs.modeText).toBe('4');
    expect(commonjs.value).toBe(42);
    const crashLine =
      source.split('\n').findIndex((line) => line.startsWith('export function crash')) + 1;
    const stack = execFileSync(
      process.execPath,
      [
        '--enable-source-maps',
        '--input-type=module',
        '-e',
        "import {crash} from './dist/index.js'; try { crash(); } catch (error) { console.log(error.stack); }"
      ],
      {cwd: directory, encoding: 'utf8'}
    );
    expect(stack).toContain(
      `${customPaths ? 'https://debugger.invalid/source' : 'src'}/index.ts:${crashLine}:`
    );
    expect(readFileSync(path.join(directory, 'src/index.ts'), 'utf8')).toBe(source);
    run();
    expect(readFileSync(path.join(directory, 'dist/index.js'), 'utf8')).toBe(js);
    const configPath = path.join(directory, 'tsconfig.json');
    const config = JSON.parse(readFileSync(configPath, 'utf8'));
    config.compilerOptions.plugins.push({transform: 'unknown-transformer'});
    writeFileSync(configPath, JSON.stringify(config));
    const unsupported = spawnSync('bash', [cli], {cwd: directory, encoding: 'utf8'});
    expect(unsupported.status).not.toBe(0);
    expect(unsupported.stderr).toContain('does not support transformer unknown-transformer');
    config.compilerOptions.plugins.pop();
    writeFileSync(configPath, JSON.stringify(config));
    writeFileSync(
      path.join(directory, 'src/value.ts'),
      'export const value: number = "wrong"; export type Value = number;'
    );
    const invalid = spawnSync('bash', [cli], {cwd: directory, encoding: 'utf8'});
    expect(invalid.status).not.toBe(0);
    expect(invalid.stdout).toContain('not assignable');
  } finally {
    rmSync(directory, {recursive: true, force: true});
  }
});

test('shared WebGL transform removes only imports made unused by inlining', () => {
  const shared = [{transform: '@vis.gl/ts-plugins/ts-transform-inline-webgl-constants'}];
  expect(
    transformOutput(
      "import {GL} from '@luma.gl/constants'; export const mode = GL.TRIANGLES;",
      '/project/index.js',
      shared,
      {TRIANGLES: 4}
    ).code
  ).toBe(' export const mode = 4;');
  expect(
    transformOutput(
      "import {GL, other} from '@luma.gl/constants'; export const mode = GL.TRIANGLES; other();",
      '/project/index.js',
      shared,
      {TRIANGLES: 4}
    ).code
  ).toContain("import {other} from '@luma.gl/constants'");
});

test('custom extensions apply independently in JavaScript and declarations', () => {
  const configured = [
    {
      transform: '@vis.gl/ts-plugins/ts-transform-append-extension',
      extensions: ['.js'],
      after: true
    },
    {
      transform: '@vis.gl/ts-plugins/ts-transform-append-extension',
      extensions: ['.lib.cjs'],
      after: true
    },
    {
      transform: '@vis.gl/ts-plugins/ts-transform-append-extension',
      extensions: ['.js'],
      afterDeclarations: true
    }
  ];
  const source = "export * from './math'; export * from './fft.lib';";
  expect(transformOutput(source, '/project/index.js', configured).code).toBe(
    "export * from './math.js'; export * from './fft.lib.cjs';"
  );
  expect(transformOutput(source, '/project/index.d.ts', configured).code).toBe(
    "export * from './math.js'; export * from './fft.lib';"
  );
});

test('numeric constant replacements remain valid before property access', () => {
  const source =
    'return [GL.TRIANGLES.toString(16), gl["TRIANGLES"].toString(), GL.TRIANGLES?.toString()];';
  const transformed = transformOutput(source, '/project/index.js', plugins, {TRIANGLES: 4});
  expect(new Function(transformed.code)()).toEqual(['4', '4', '4']);
});

test('constants resolution supports explicit files, packages, defaults, and no graphics plugin', () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'ocular-constants-'));
  try {
    const config = path.join(directory, 'tsconfig.json');
    const plugin = {transform: '@vis.gl/ts-plugins/ts-transform-inline-webgl-constants'};
    writeFileSync(path.join(directory, 'custom.cjs'), 'exports.GL = {CUSTOM: 71};');
    mkdirSync(path.join(directory, 'node_modules/custom-constants'), {recursive: true});
    writeFileSync(
      path.join(directory, 'node_modules/custom-constants/package.json'),
      '{"main":"index.cjs"}'
    );
    writeFileSync(
      path.join(directory, 'node_modules/custom-constants/index.cjs'),
      'exports.GL = {CUSTOM: 72};'
    );
    expect(loadConstants([], config)).toEqual({});
    expect(loadConstants([{...plugin, constantsModule: './custom.cjs'}], config)).toEqual({
      CUSTOM: 71
    });
    expect(loadConstants([{...plugin, constantsModule: 'custom-constants'}], config)).toEqual({
      CUSTOM: 72
    });
    expect(loadConstants([plugin], config).TRIANGLES).toBe(4);
    expect(() => loadConstants([{...plugin, constantsModule: './missing.cjs'}], config)).toThrow();
  } finally {
    rmSync(directory, {recursive: true, force: true});
  }
});

test('version shorthand and reverse enum lookups preserve valid JavaScript', () => {
  const versioned = transformOutput(
    'return {__VERSION__};',
    fileURLToPath(new URL('../src/index.ts', import.meta.url)),
    plugins
  ).code;
  expect(new Function(versioned)()).toHaveProperty('__VERSION__', '2.0.0-beta.1');
  const constants = {TRIANGLES: 4, '4': 'TRIANGLES'} as unknown as Record<string, number>;
  expect(
    transformOutput('GL["4"]; GL.TRIANGLES;', '/project/index.js', plugins, constants).code
  ).toBe('GL["4"]; 4;');
});

test.each([
  '@vis.gl/ts-plugins',
  'ocular-dev-tools',
  '@framework/custom'
])('constant pruning uses the same transform matching for %s', (prefix) => {
  const configured = [{transform: `${prefix}/ts-transform-inline-webgl-constants`}];
  expect(
    transformOutput(
      "import {GL} from '@luma.gl/constants'; export const mode = GL.TRIANGLES;",
      '/project/index.js',
      configured,
      {TRIANGLES: 4}
    ).code
  ).toBe(' export const mode = 4;');
  expect(
    transformOutput(
      "import {GL} from '@luma.gl/constants'; export const mode = GL.TRIANGLES;",
      '/project/index.js',
      [{...configured[0], pruneImports: false}],
      {TRIANGLES: 4}
    ).code
  ).toContain('import {GL}');
});

test('native monorepo builds packages with independent versions and no graphics transforms', () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'ocular-framework-'));
  const require = createRequire(import.meta.url);
  try {
    mkdirSync(path.join(directory, 'node_modules'));
    symlinkSync(
      path.dirname(require.resolve('typescript-native/package.json')),
      path.join(directory, 'node_modules/typescript'),
      'junction'
    );
    writeFileSync(
      path.join(directory, 'package.json'),
      '{"name":"framework","type":"module","version":"0.0.0"}'
    );
    writeFileSync(
      path.join(directory, '.ocularrc.js'),
      `export default {typescript: {project: 'tsconfig.json', compiler: 'native'}};`
    );
    for (const [name, version] of [
      ['math', '3.2.1'],
      ['logging', '4.5.6']
    ]) {
      const module = path.join(directory, 'modules', name);
      mkdirSync(path.join(module, 'src'), {recursive: true});
      writeFileSync(
        path.join(module, 'package.json'),
        JSON.stringify({name, version, type: 'module'})
      );
      writeFileSync(
        path.join(module, 'tsconfig.json'),
        JSON.stringify({
          compilerOptions: {
            target: 'esnext',
            module: 'esnext',
            moduleResolution: 'bundler',
            rootDir: 'src',
            types: [],
            plugins: plugins.filter((plugin) => !/webgl|glsl/.test(plugin.transform))
          },
          include: ['src']
        })
      );
      writeFileSync(
        path.join(module, 'src/index.ts'),
        "declare const __VERSION__: string; export const version = __VERSION__; export {value} from './value';"
      );
      writeFileSync(path.join(module, 'src/value.ts'), 'export const value = 42;');
    }
    const cli = fileURLToPath(new URL('../scripts/build.sh', import.meta.url));
    execFileSync('bash', [cli], {cwd: directory, encoding: 'utf8'});
    for (const [name, version] of [
      ['math', '3.2.1'],
      ['logging', '4.5.6']
    ]) {
      const module = path.join(directory, 'modules', name);
      expect(require(path.join(module, 'dist/index.cjs')).version).toBe(version);
      expect(readFileSync(path.join(module, 'dist/index.d.ts'), 'utf8')).toContain("'./value.js'");
    }
    writeFileSync(
      path.join(directory, '.ocularrc.js'),
      `export default {typescript: {project: 'tsconfig.json', compiler: 'Native'}};`
    );
    const invalid = spawnSync('bash', [cli], {cwd: directory, encoding: 'utf8'});
    expect(invalid.status).not.toBe(0);
    expect(invalid.stderr).toContain('Unknown typescript.compiler: Native');
  } finally {
    rmSync(directory, {recursive: true, force: true});
  }
});
