const {resolve} = require('path');
const {getDocusaurusConfig} = require('@vis.gl/docusaurus-website');

const config = getDocusaurusConfig({
  projectName: 'dev-tools',
  tagline: 'Shared development tools for vis.gl projects',
  siteUrl: 'https://visgl.github.io/dev-tools/',
  repoUrl: 'https://github.com/visgl/dev-tools',
  docsTableOfContents: require('../docs/table-of-contents.json'),
  search: 'local',
  plugins: [
    ['@docusaurus/plugin-content-docs', {
      id: 'dev-tools',
      path: resolve(__dirname, '../modules/dev-tools/docs'),
      routeBasePath: 'docs/dev-tools',
      sidebarPath: resolve(__dirname, './src/sidebars/dev-tools.js'),
      breadcrumbs: false,
      editUrl: 'https://github.com/visgl/dev-tools/tree/master/modules/dev-tools/docs/'
    }],
    ['@docusaurus/plugin-content-docs', {
      id: 'ts-plugins',
      path: resolve(__dirname, '../modules/ts-plugins/docs'),
      routeBasePath: 'docs/ts-plugins',
      sidebarPath: resolve(__dirname, './src/sidebars/ts-plugins.js'),
      breadcrumbs: false,
      editUrl: 'https://github.com/visgl/dev-tools/tree/master/modules/ts-plugins/docs/'
    }],
    ['@docusaurus/plugin-client-redirects', {
      redirects: [
        {from: '/about', to: '/docs'},
        {from: '/docs/ocular-dev-tools', to: '/docs/dev-tools'},
        {from: '/docs/gatsby-theme-ocular', to: '/docs/legacy-gatsby'},
        {from: '/ocular-dev-tools', to: '/docs/dev-tools'},
        {from: '/gatsby-theme-ocular', to: '/docs/legacy-gatsby'}
      ]
    }]
  ]
});

config.baseUrl = process.env.WEBSITE_BASE_URL || '/dev-tools/';

module.exports = config;
