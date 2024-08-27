import {resolve, dirname} from 'path';
import lightCodeTheme from 'prism-react-renderer/themes/nightOwlLight';
import darkCodeTheme from 'prism-react-renderer/themes/nightOwl';
import deepmerge from 'deepmerge';
import type {Config} from '@docusaurus/types';
import type {Options as ClassicThemeOptions, ThemeConfig} from '@docusaurus/preset-classic';

const cwd = dirname(typeof require === 'undefined' ? import.meta.url : __filename);

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
  webpackConfig: object;

  /** Path to documentation pages (.md and .mdx), relative to the current directory */
  docsDir?: string;
  /** Documentation table of contents */
  docsTableOfContents: SidebarItem[];

  /** Path to example pages (.mdx), relative to the current directory */
  examplesDir?: string;
  /** Examples table of contents */
  exampleTableOfContents?: SidebarItem[];

  /** Search settings */
  search?: false | 'local' | ThemeConfig['algolia'];
};

export function getDocusaurusConfig(config: OcularWebsiteConfig): Config {
  const siteUrl = new URL(config.siteUrl);

  return {
    title: config.projectName,
    tagline: config.tagline,
    url: siteUrl.origin,
    baseUrl: siteUrl.pathname,
    onBrokenLinks: 'warn',
    onBrokenMarkdownLinks: 'warn',
    favicon: '/favicon.png',
    organizationName: 'visgl',
    projectName: config.projectName,
    trailingSlash: false,
    staticDirectories: ['static', resolve(cwd, '../static')],

    presets: [
      [
        'classic',
        {
          docs: {
            path: config.docsDir ?? '../docs',
            sidebarItemsGenerator: () => config.docsTableOfContents.map(normalizeSidebarItem),
            editUrl: `${config.repoUrl}/tree/master/docs`
          },
          theme: {
            customCss: [resolve(cwd, '../src/styles.css')]
          }
        } as ClassicThemeOptions
      ]
    ],

    plugins: [
      [
        '@vis.gl/docusaurus-website/plugin-webpack-config',
        deepmerge(
          {
            debug: true,
            resolve: {
              modules: [resolve('node_modules'), resolve('../node_modules')],
              alias: {}
            },
            plugins: [],
            module: {}
          },
          config.webpackConfig
        )
      ],
      config.examplesDir && [
        '@docusaurus/plugin-content-docs',
        {
          id: 'examples',
          path: config.examplesDir,
          routeBasePath: 'examples',
          sidebarItemsGenerator: () => config.exampleTableOfContents?.map(normalizeSidebarItem),
          breadcrumbs: false,
          docItemComponent: resolve(cwd, './components/example/doc-item-component.js')
        }
      ],
      config.search === 'local' && [
        '@cmfcmf/docusaurus-search-local',
        {
          // Options here
        }
      ]
    ].filter(Boolean),

    themeConfig: {
      navbar: {
        title: config.projectName,
        logo: {
          alt: 'vis.gl Logo',
          src: '/visgl-logo-dark.png',
          srcDark: '/visgl-logo-light.png'
        },
        items: [
          config.examplesDir && {
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
            href: config.repoUrl,
            label: 'GitHub',
            position: 'right'
          }
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
            ].filter((item) => item.label !== config.projectName)
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
                href: config.repoUrl
              }
            ]
          }
        ],
        copyright: `Copyright © ${new Date().getFullYear()} OpenJS Foundation`
      },
      algolia: typeof config.search === 'object' ? config.search : undefined,
      prism: {
        theme: lightCodeTheme,
        darkTheme: darkCodeTheme
      }
    } as ThemeConfig
  } as Config;
}
