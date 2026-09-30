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

test('getDocusaurusConfig normalizes nested documentation sidebars', () => {
  const config = getDocusaurusConfig({
    projectName: 'test-project',
    repoUrl: 'https://github.com/visgl/test-project',
    siteUrl: 'https://example.com',
    docsTableOfContents: [
      'overview',
      {type: 'category', label: 'Guides', items: ['setup', {type: 'doc', id: 'advanced'}]}
    ]
  });
  const [, presetOptions] = config.presets![0] as [
    string,
    {docs: {sidebarItemsGenerator: () => unknown}}
  ];

  expect(presetOptions.docs.sidebarItemsGenerator()).toEqual([
    {type: 'doc', id: 'overview'},
    {
      type: 'category',
      label: 'Guides',
      items: [
        {type: 'doc', id: 'setup'},
        {type: 'doc', id: 'advanced'}
      ]
    }
  ]);
});
