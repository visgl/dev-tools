import {expect, test} from 'vitest';
import type {TestProjectInlineConfiguration} from 'vitest/config';
import {getOcularConfig, getVitestConfig} from '@vis.gl/dev-tools';
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
