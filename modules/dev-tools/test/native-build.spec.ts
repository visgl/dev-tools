import {expect, test} from 'vitest';
import {execFileSync, spawnSync} from 'node:child_process';
import {mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, symlinkSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {transformOutput} from '../src/native-build.js';

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

test('native compiler builds extensionless modules with all luma transforms and stable maps', () => {
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
          plugins
        },
        include: ['src']
      })
    );
    const source = `declare const __VERSION__: string;
declare const GL: {TRIANGLES: number};
declare function glsl(strings: TemplateStringsArray, ...values: unknown[]): string;
export {value} from './value';
export const version = __VERSION__;
export const mode = GL.TRIANGLES;
export const shader = glsl\`// comment
void main() { /* remove */ }
\`;
export const load = () => import('./value');
export type Value = import('./value').Value;
export function crash() { throw new Error('source-map-fixture'); }
`;
    writeFileSync(path.join(directory, 'src/index.ts'), source);
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
    expect(readFileSync(path.join(directory, 'dist/index.d.ts'), 'utf8')).toContain(
      "import('./value.js')"
    );
    for (const name of ['index.js.map', 'index.d.ts.map']) {
      const map = JSON.parse(readFileSync(path.join(directory, 'dist', name), 'utf8'));
      expect(map.sources).toEqual(['../src/index.ts']);
      expect(map.mappings.length).toBeGreaterThan(0);
    }
    const commonjs = require(path.join(directory, 'dist/index.cjs'));
    expect(commonjs.version).toBe('1.2.3');
    expect(commonjs.mode).toBe(4);
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
    expect(stack).toContain(`src/index.ts:${crashLine}:`);
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
