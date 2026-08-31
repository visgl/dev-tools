import {expect, test} from 'vitest';
import type {TestProjectInlineConfiguration} from 'vitest/config';
import {getOcularConfig, getVitestConfig} from '@vis.gl/dev-tools';
import {getBundleConfig, parseBundleArguments} from '../src/configuration/get-esbuild-config.js';
import {execFileSync} from 'node:child_process';
import {mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
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
      '--debug=false'
    ])
  ).toEqual({
    input: './bundle.ts',
    output: 'dist/index.js',
    format: 'esm',
    externals: ['@vis.gl/tangram-renderer', 'zod'],
    target: ['chrome110', 'safari15'],
    sourcemap: true,
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
    externals: ['@vis.gl/dev-tools', 'zod']
  });

  expect(config.entryPoints).toEqual(['./bundle.ts']);
  expect(config.external).toEqual(['@vis.gl/dev-tools', 'zod']);
  expect(config.alias).not.toHaveProperty('@vis.gl/dev-tools');
  expect(config.alias).not.toHaveProperty('@vis.gl/dev-tools/test');
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
