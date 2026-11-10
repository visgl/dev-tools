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

test('getDocusaurusConfig merges custom arrays and nested configuration without mutating inputs', () => {
  const options = {
    projectName: 'test-project',
    repoUrl: 'https://github.com/visgl/test-project',
    siteUrl: 'https://example.com',
    docsTableOfContents: []
  };
  const defaults = getDocusaurusConfig(options);
  const webpackConfig = {resolve: {modules: ['/custom/node_modules'], alias: {custom: '/custom'}}};
  const themeConfig = {navbar: {items: [{label: 'Custom', href: '/custom'}]}};
  const original = structuredClone({webpackConfig, themeConfig});
  const config = getDocusaurusConfig({...options, webpackConfig, themeConfig});
  const [, defaultWebpack] = defaults.plugins![0] as [
    string,
    {resolve: {modules: string[]; alias: Record<string, string>}}
  ];
  const [, actualWebpack] = config.plugins![0] as [
    string,
    {resolve: {modules: string[]; alias: Record<string, string>}}
  ];

  expect(actualWebpack.resolve.modules).toEqual([
    ...defaultWebpack.resolve.modules,
    '/custom/node_modules'
  ]);
  expect(actualWebpack.resolve.alias).toEqual({...defaultWebpack.resolve.alias, custom: '/custom'});
  expect(config.themeConfig).toMatchObject({
    navbar: {
      title: 'test-project',
      items: expect.arrayContaining([
        {label: 'Custom', href: '/custom'},
        {to: '/docs', label: 'Docs', position: 'left'}
      ])
    }
  });
  expect({webpackConfig, themeConfig}).toEqual(original);
});

test('getDocusaurusConfig rejects prototype keys throughout custom configuration', () => {
  const hostile = JSON.parse(
    '{"__proto__":{"polluted":true},"navbar":{"__proto__":{"polluted":true},"items":[{"__proto__":{"polluted":true},"label":"Custom"}]}}'
  );
  const config = getDocusaurusConfig({
    projectName: 'test-project',
    repoUrl: 'https://github.com/visgl/test-project',
    siteUrl: 'https://example.com',
    docsTableOfContents: [],
    themeConfig: hostile,
    webpackConfig: {
      resolve: JSON.parse(
        '{"__proto__":{"polluted":true},"alias":{"__proto__":{"polluted":true},"safe":"/safe"}}'
      )
    }
  });
  const assertSafe = (value: unknown) => {
    if (!value || typeof value !== 'object') return;
    expect(Object.hasOwn(value, '__proto__')).toBe(false);
    expect('polluted' in value).toBe(false);
    expect(Object.getPrototypeOf(value)).toBe(
      Array.isArray(value) ? Array.prototype : Object.prototype
    );
    for (const nested of Object.values(value)) assertSafe(nested);
  };
  assertSafe(config.themeConfig);
  const [, webpack] = config.plugins![0] as [string, {resolve: object}];
  assertSafe(webpack.resolve);
  expect(Object.hasOwn(Object.prototype, 'polluted')).toBe(false);
});
