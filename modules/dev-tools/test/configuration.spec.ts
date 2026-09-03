import {expect, test} from 'vitest';
import type {TestProjectInlineConfiguration} from 'vitest/config';
import {getOcularConfig, getVitestConfig} from '@vis.gl/dev-tools';
import {
  getBundleConfig,
  getCJSExportConfig,
  parseBundleArguments
} from '../src/configuration/get-esbuild-config.js';
import {execFileSync} from 'node:child_process';
import {build} from 'esbuild';
import {mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

test('dev-tools#getConfig', () => {
  expect(getOcularConfig).toBeTypeOf('function');
});

test('dev-tools#getVitestConfig', () => {
  const config = getVitestConfig();

  expect(config.test?.projects).toHaveLength(3);
  expect(config.test?.coverage).toMatchObject({provider: 'v8'});
});

test('dev-tools#getVitestConfig merges and adds projects', () => {
  const config = getVitestConfig({
    projects: {
      node: {
        resolve: {conditions: ['custom']},
        test: {include: ['test/custom.spec.ts']}
      },
      browser: false,
      render: {
        test: {include: ['test/render.spec.ts']}
      }
    }
  });
  const projects = config.test?.projects as TestProjectInlineConfiguration[];

  expect(projects.map((project) => project.test?.name)).toEqual(['node', 'headless', 'render']);
  expect(projects[0]).toMatchObject({
    resolve: {conditions: ['custom']},
    test: {
      environment: 'node',
      include: ['test/custom.spec.ts'],
      testTimeout: 60_000
    }
  });
  expect(projects[2]).toMatchObject({
    extends: true,
    test: {name: 'render', include: ['test/render.spec.ts']}
  });
});

test('dev-tools#getVitestConfig supports legacy project overrides', () => {
  const config = getVitestConfig({node: {include: ['test/legacy.spec.ts']}});
  const projects = config.test?.projects as TestProjectInlineConfiguration[];

  expect(projects[0].test).toMatchObject({
    name: 'node',
    environment: 'node',
    include: ['test/legacy.spec.ts']
  });
});

test('dev-tools#getVitestConfig resolves explicit wildcard aliases to their wildcard target', () => {
  const fixturePath = fileURLToPath(new URL('./fixtures/tsconfig-aliases.json', import.meta.url));
  const config = getVitestConfig({tsconfigProjects: [fixturePath]});
  const aliases = config.resolve?.alias as Array<{find: string | RegExp; replacement: string}>;
  const subpath = '@example/package/feature';
  const matchingAlias = aliases.find(({find}) =>
    typeof find === 'string' ? find === subpath : find.test(subpath)
  );

  expect(matchingAlias?.replacement).toBe(
    path.resolve(path.dirname(fixturePath), 'src/$1').replace(/\\/g, '/')
  );
});

test('dev-tools#parseBundleArguments normalizes CLI values', () => {
  expect(
    parseBundleArguments([
      './bundle.ts',
      '--output=dist/index.js',
      '--format=esm',
      '--externals=@vis.gl/tangram-renderer,zod',
      '--target=chrome110,safari15',
      '--sourcemap',
      '--sourcesContent=false',
      '--debug=false'
    ])
  ).toEqual({
    input: './bundle.ts',
    output: 'dist/index.js',
    format: 'esm',
    externals: ['@vis.gl/tangram-renderer', 'zod'],
    target: ['chrome110', 'safari15'],
    sourcemap: true,
    sourcesContent: false,
    debug: false
  });
});

test('dev-tools#parseBundleArguments requires an entry point', () => {
  expect(() => parseBundleArguments(['--format=esm'])).toThrow(
    'ocular-bundle requires a JavaScript or TypeScript entry point'
  );
});

test('dev-tools#getBundleConfig passes normalized externals to esbuild', async () => {
  const config = await getBundleConfig({
    input: './bundle.ts',
    format: 'esm',
    externals: ['@vis.gl/dev-tools', 'zod'],
    sourcesContent: false
  });

  expect(config.entryPoints).toEqual(['./bundle.ts']);
  expect(config.external).toEqual(['@vis.gl/dev-tools', 'zod']);
  expect(config.sourcesContent).toBe(false);
  expect(config.alias).not.toHaveProperty('@vis.gl/dev-tools');
  expect(config.alias).not.toHaveProperty('@vis.gl/dev-tools/test');
});

test('dev-tools#getCJSExportConfig neutralizes tsconfig paths', async () => {
  const config = await getCJSExportConfig({
    input: './dist/index.js',
    output: './dist/index.cjs'
  });

  expect(config.packages).toBe('external');
  expect(config.tsconfigRaw).toEqual({compilerOptions: {paths: {}}});
});

test('dev-tools#getCJSExportConfig keeps workspace packages out of the bundle', async () => {
  const fixtureDirectory = mkdtempSync(path.join(tmpdir(), 'ocular-cjs-'));

  try {
    // A monorepo that maps its own scope to sibling sources, as vis.gl repos do.
    writeFileSync(
      path.join(fixtureDirectory, 'tsconfig.json'),
      JSON.stringify({
        compilerOptions: {
          moduleResolution: 'bundler',
          paths: {'@example/sibling': ['./sibling/src/index.js']}
        }
      })
    );
    mkdirSync(path.join(fixtureDirectory, 'sibling', 'src'), {recursive: true});
    writeFileSync(
      path.join(fixtureDirectory, 'sibling', 'src', 'index.js'),
      "export const sibling = 'incorrectly bundled';\n"
    );
    mkdirSync(path.join(fixtureDirectory, 'dist'), {recursive: true});
    writeFileSync(
      path.join(fixtureDirectory, 'dist', 'index.js'),
      "import {sibling} from '@example/sibling';\nexport const value = sibling;\n"
    );

    const config = await getCJSExportConfig({
      input: path.join(fixtureDirectory, 'dist', 'index.js'),
      output: path.join(fixtureDirectory, 'dist', 'index.cjs')
    });
    await build({...config, logLevel: 'silent'});

    const output = readFileSync(path.join(fixtureDirectory, 'dist', 'index.cjs'), 'utf8');
    expect(output).toContain('require("@example/sibling")');
    expect(output).not.toContain('incorrectly bundled');
  } finally {
    rmSync(fixtureDirectory, {recursive: true, force: true});
  }
});

test('ocular-bundle CLI bundles the requested entry point', () => {
  const fixtureDirectory = mkdtempSync(path.join(tmpdir(), 'ocular-bundle-'));
  const scriptPath = fileURLToPath(new URL('../scripts/bundle.js', import.meta.url));

  try {
    writeFileSync(
      path.join(fixtureDirectory, 'package.json'),
      JSON.stringify({name: 'ocular-bundle-fixture', type: 'module'})
    );
    writeFileSync(
      path.join(fixtureDirectory, '.ocularrc.js'),
      `export default {aliases: {'external-package': ${JSON.stringify(
        path.join(fixtureDirectory, 'aliased-external.js')
      )}}};\n`
    );
    writeFileSync(
      path.join(fixtureDirectory, 'aliased-external.js'),
      "export default 'incorrectly bundled';\n"
    );
    writeFileSync(
      path.join(fixtureDirectory, 'entry.js'),
      "import externalValue from 'external-package';\nexport const value = `fixture:${externalValue}`;\n"
    );

    execFileSync(
      process.execPath,
      [
        scriptPath,
        './entry.js',
        '--env=dev',
        '--output=./bundle.js',
        '--format=esm',
        '--externals=external-package,zod'
      ],
      {cwd: fixtureDirectory, stdio: 'pipe'}
    );

    const bundle = readFileSync(path.join(fixtureDirectory, 'bundle.js'), 'utf8');
    expect(bundle).toContain('fixture:');
    expect(bundle).toContain('from "external-package"');
    expect(bundle).not.toContain('incorrectly bundled');
    expect(bundle).not.toContain('@vis.gl/dev-tools/scripts/bundle.js');
  } finally {
    rmSync(fixtureDirectory, {recursive: true, force: true});
  }
});
