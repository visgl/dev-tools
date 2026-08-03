import {expect, test} from 'vitest';
import type {TestProjectInlineConfiguration} from 'vitest/config';
import {getOcularConfig, getVitestConfig} from '@vis.gl/dev-tools';

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
      testTimeout: 30_000
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
