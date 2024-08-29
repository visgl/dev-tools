import fs from 'fs';
import {resolve, dirname} from 'path';
import deepmerge from 'deepmerge';
import type {Config, PluginConfig} from '@docusaurus/types';
import type {NavbarItem} from '@docusaurus/theme-common';
import type {Options as ClassicThemeOptions, ThemeConfig} from '@docusaurus/preset-classic';
import {themes} from 'prism-react-renderer';

const cwd = dirname(typeof require === 'undefined' ? import.meta.url : __filename);
const lightCodeTheme = themes.nightOwlLight;
const darkCodeTheme = themes.nightOwl;

type SidebarItem = {
  type: 'category' | 'doc';
  id?: string;
  label?: string;
  items?: (string | SidebarItem)[];
};

/** Convert string style item to object style */
function normalizeSidebarItem(item: SidebarItem | string): SidebarItem {
  if (typeof item === 'string') {
    return {
      type: 'doc',
      id: item
    };
  }
  if (item.items) {
    item.items = item.items.map(normalizeSidebarItem);
  }
  return item;
}

function getAlias(packageRoot: string, target: {[moduleName: string]: string}) {
  const packageJsonFile = resolve(packageRoot, 'package.json');
  if (fs.existsSync(packageJsonFile)) {
    const packageInfo = JSON.parse(fs.readFileSync(packageJsonFile, 'utf8'));
    target[packageInfo.name] = resolve(packageRoot, 'src');
  }
  return null;
}

function getAliases(root: string): {[moduleName: string]: string} {
  const result: {[moduleName: string]: string} = {};
  const parentPath = resolve(root, './modules');

  if (fs.existsSync(parentPath)) {
    // monorepo
    for (const item of fs.readdirSync(parentPath)) {
      const itemPath = resolve(parentPath, item);
      getAlias(itemPath, result);
    }
  } else {
    getAlias(root, result);
  }

  return result;
}

export type OcularWebsiteConfig = {
  /** Name of the project */
  projectName: string;

  /** Tagline for the website */
  tagline?: string;

  /** GitHub repo URL, e.g. https://github.com/visgl/react-map-gl */
  repoUrl: string;

  /** Public website URL, e.g. https://visgl.github.io/react-map-gl */
  siteUrl: string;

  /** Custom webpack config */
  webpackConfig?: object;

  /** Path to repo root, relative to the current directory
   * @default ".."
   */
  rootDir?: string;

  /** Path to documentation pages (.md and .mdx), relative to the current directory
   * @default "../docs"
   */
  docsDir?: string;
  /** Documentation table of contents */
  docsTableOfContents: SidebarItem[];

  /** Path to example pages (.mdx), relative to the current directory */
  examplesDir?: string;
  /** Examples table of contents */
  exampleTableOfContents?: SidebarItem[];

  /** Search settings */
  search?: false | 'local' | ThemeConfig['algolia'];

  /** Additional CSS files to include */
  customCss?: string[];

  /** Additional navbar items */
  navbarItems?: NavbarItem[];

  /** Additional plugins */
  plugins?: PluginConfig[];
};

export function getDocusaurusConfig(config: OcularWebsiteConfig): Config {
  const siteUrl = new URL(config.siteUrl);
  const {
    projectName,
    tagline,
    repoUrl,
    rootDir = '..',
    docsDir = '../docs',
    search = false,
    docsTableOfContents,
    examplesDir,
    exampleTableOfContents,
    webpackConfig = {},
    customCss = [],
    navbarItems = [],
    plugins = []
  } = config;
  const hasExamples = Boolean(examplesDir && exampleTableOfContents);

  return {
    title: projectName,
    tagline,
    url: siteUrl.origin,
    baseUrl: siteUrl.pathname,
    onBrokenLinks: 'warn',
    onBrokenMarkdownLinks: 'warn',
    favicon: '/favicon.png',
    organizationName: 'visgl',
    projectName,
    trailingSlash: false,
    staticDirectories: ['static', resolve(cwd, '../static')],

    presets: [
      [
        'classic',
        {
          docs: {
            path: docsDir,
            sidebarItemsGenerator: () => docsTableOfContents.map(normalizeSidebarItem),
            editUrl: `${repoUrl}/tree/master/docs`
          },
          theme: {
            customCss: [resolve(cwd, '../src/styles.css'), ...customCss]
          }
        } as ClassicThemeOptions
      ]
    ],

    plugins: [
      [
        '@vis.gl/docusaurus-website/plugin-webpack-config',
        deepmerge(
          {
            resolve: {
              modules: [resolve('node_modules'), resolve(rootDir, 'node_modules')],
              alias: getAliases(rootDir)
            },
            plugins: [],
            module: {}
          },
          webpackConfig
        )
      ],
      hasExamples && [
        '@docusaurus/plugin-content-docs',
        {
          id: 'examples',
          path: examplesDir,
          routeBasePath: 'examples',
          sidebarItemsGenerator: () => exampleTableOfContents?.map(normalizeSidebarItem),
          breadcrumbs: false,
          docItemComponent: resolve(cwd, './components/doc-item-component.js')
        }
      ],
      search === 'local' && [
        '@cmfcmf/docusaurus-search-local',
        {
          // Options here
        }
      ],
      ...plugins
    ].filter(Boolean),

    themeConfig: {
      navbar: {
        title: projectName,
        logo: {
          alt: 'vis.gl Logo',
          src: '/visgl-logo-dark.png',
          srcDark: '/visgl-logo-light.png'
        },
        items: [
          hasExamples && {
            to: '/examples',
            position: 'left',
            label: 'Examples'
          },
          {
            to: '/docs',
            position: 'left',
            label: 'Docs'
          },
          {
            href: repoUrl,
            label: 'GitHub',
            position: 'right'
          },
          ...navbarItems
        ].filter(Boolean)
      },
      footer: {
        style: 'dark',
        links: [
          {
            title: 'Other vis.gl Libraries',
            items: [
              {
                label: 'deck.gl',
                href: 'https:/deck.gl'
              },
              {
                label: 'luma.gl',
                href: 'https://luma.gl'
              },
              {
                label: 'loaders.gl',
                href: 'https://loaders.gl'
              },
              {
                label: 'react-map-gl',
                href: 'https://visgl.github.io/react-map-gl'
              },
              {
                label: 'deck.gl-community',
                href: 'https://visgl.github.io/deck.gl-community/'
              }
            ].filter((item) => item.label !== projectName)
          },
          {
            title: 'More',
            items: [
              {
                label: 'vis.gl blog on Medium',
                href: 'https://medium.com/vis-gl'
              },
              {
                label: 'GitHub',
                href: repoUrl
              }
            ]
          }
        ],
        copyright: `Copyright © ${new Date().getFullYear()} OpenJS Foundation`
      },
      algolia: typeof search === 'object' ? search : undefined,
      prism: {
        theme: lightCodeTheme,
        darkTheme: darkCodeTheme
      }
    } as ThemeConfig
  } as Config;
}
