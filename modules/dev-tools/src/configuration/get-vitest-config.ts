import fs from 'node:fs';
import path from 'node:path';

import {playwright, type PlaywrightProviderOptions} from '@vitest/browser-playwright';
import ts from 'typescript';
import {
  defineConfig,
  type TestProjectInlineConfiguration,
  type TestUserConfig,
  type ViteUserConfig
} from 'vitest/config';

type VitestProjectOptions = NonNullable<TestProjectInlineConfiguration['test']>;
export type VitestProjectConfig = TestProjectInlineConfiguration;

export type VitestConfigOptions = {
  /** TypeScript projects whose path aliases should be available to tests. */
  tsconfigProjects?: string[];
  /** Additional Vite configuration merged over the shared defaults. */
  overrides?: ViteUserConfig;
  /** Test files excluded from every project. */
  excludePatterns?: string[];
  /** Browser used by the headed and headless projects. */
  browserName?: 'chromium' | 'firefox' | 'webkit';
  /** Default timeout for browser tests. */
  testTimeout?: number;
  /** Playwright launch options shared by headed and headless projects. */
  launchOptions?: PlaywrightProviderOptions['launchOptions'];
  /** Coverage settings merged over the shared V8 defaults. */
  coverage?: TestUserConfig['coverage'];
  /** Project configurations deeply merged with defaults of the same name. */
  projects?: Record<string, VitestProjectConfig | false>;
  /** @deprecated Use `projects.node.test` instead. */
  node?: VitestProjectOptions;
  /** @deprecated Use `projects.browser.test` instead. */
  browser?: VitestProjectOptions;
  /** @deprecated Use `projects.headless.test` instead. */
  headless?: VitestProjectOptions;
};

/** Creates a Vitest configuration with Node, headed browser, and headless browser projects. */
export function getVitestConfig(options: VitestConfigOptions = {}) {
  const {
    tsconfigProjects = ['./tsconfig.json'],
    excludePatterns = [],
    browserName = 'chromium',
    testTimeout = 60_000,
    launchOptions,
    coverage = {},
    projects = {},
    node = {},
    browser = {},
    headless = {},
    overrides = {}
  } = options;
  const aliases = getTsconfigAliases(tsconfigProjects);
  const createBrowserProvider = () => playwright({launchOptions});
  const defaultProjects: Record<string, VitestProjectConfig> = {
    node: {
      extends: true,
      test: {
        name: 'node',
        environment: 'node',
        testTimeout,
        include: ['modules/**/*.node.spec.{ts,js}', 'test/**/*.node.spec.{ts,js}'],
        exclude: excludePatterns,
        ...node
      }
    },
    browser: {
      extends: true,
      test: {
        name: 'browser',
        include: ['modules/**/*.browser.spec.{ts,js}', 'test/**/*.browser.spec.{ts,js}'],
        exclude: excludePatterns,
        testTimeout,
        browser: {
          enabled: true,
          provider: createBrowserProvider(),
          instances: [{browser: browserName, headless: false}]
        },
        ...browser
      }
    },
    headless: {
      extends: true,
      test: {
        name: 'headless',
        include: ['modules/**/*.browser.spec.{ts,js}', 'test/**/*.browser.spec.{ts,js}'],
        exclude: excludePatterns,
        testTimeout,
        browser: {
          enabled: true,
          provider: createBrowserProvider(),
          instances: [{browser: browserName, headless: true}]
        },
        ...headless
      }
    }
  };
  const projectConfigs = getProjectConfigs(defaultProjects, projects);

  return defineConfig({
    resolve: {alias: aliases},
    ...overrides,
    test: {
      projects: projectConfigs,
      coverage: {
        provider: 'v8',
        reporter: ['text', 'lcov'],
        ...coverage
      }
    }
  });
}

function getProjectConfigs(
  defaults: Record<string, VitestProjectConfig>,
  overrides: Record<string, VitestProjectConfig | false>
): VitestProjectConfig[] {
  const configs: Record<string, VitestProjectConfig | false> = {...defaults};

  for (const [name, project] of Object.entries(overrides)) {
    configs[name] =
      project === false
        ? false
        : deepMerge(defaults[name] || {extends: true, test: {name}}, project);
  }

  return Object.values(configs).filter(
    (project): project is VitestProjectConfig => project !== false
  );
}

function deepMerge<T>(base: T, override: T): T {
  if (!isPlainObject(base) || !isPlainObject(override)) {
    return override === undefined ? base : override;
  }

  const result: Record<string, unknown> = {...base};
  for (const [key, value] of Object.entries(override)) {
    const baseValue = result[key];
    // Vitest providers contain behavior as well as data and must remain intact.
    result[key] =
      key !== 'provider' && isPlainObject(baseValue) && isPlainObject(value)
        ? deepMerge(baseValue, value)
        : value === undefined
          ? baseValue
          : value;
  }
  return result as T;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function getTsconfigAliases(tsconfigProjects: string[]) {
  const aliases: Array<{find: string | RegExp; replacement: string; key: string}> = [];

  for (const tsconfigProject of tsconfigProjects) {
    const tsconfigPath = path.resolve(tsconfigProject);
    if (!fs.existsSync(tsconfigPath)) {
      continue;
    }
    const {config, error} = ts.readConfigFile(tsconfigPath, ts.sys.readFile);
    if (error || !config?.compilerOptions?.paths) {
      continue;
    }
    const baseUrl = config.compilerOptions.baseUrl || '.';
    const configDirectory = path.dirname(tsconfigPath);

    for (const [aliasPattern, targets] of Object.entries(config.compilerOptions.paths)) {
      const firstTarget = Array.isArray(targets) ? targets[0] : undefined;
      if (!firstTarget) {
        continue;
      }
      if (aliasPattern.endsWith('/*') && firstTarget.endsWith('/*')) {
        const prefix = escapeRegExp(aliasPattern.slice(0, -2));
        const replacement = path
          .resolve(configDirectory, baseUrl, firstTarget.slice(0, -2))
          .replace(/\\/g, '/');
        aliases.push({
          key: aliasPattern,
          find: new RegExp(`^${prefix}/(.+)$`),
          replacement: `${replacement}/$1`
        });
      } else {
        const replacement = path.resolve(configDirectory, baseUrl, firstTarget).replace(/\\/g, '/');
        aliases.push({
          key: aliasPattern,
          find: aliasPattern,
          replacement
        });
      }
    }
  }

  aliases.sort((left, right) => right.key.length - left.key.length);
  return aliases.map(({find, replacement}) => ({find, replacement}));
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
