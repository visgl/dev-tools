import {expect, test} from 'vitest';
import {getDocusaurusConfig} from '../src/get-default-config.js';

test('getDocusaurusConfig supports omitted webpackConfig', () => {
  expect(() =>
    getDocusaurusConfig({
      projectName: 'test-project',
      repoUrl: 'https://github.com/visgl/test-project',
      siteUrl: 'https://example.com',
      docsTableOfContents: []
    })
  ).not.toThrow();
});
