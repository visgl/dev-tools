/* @typedef {import('./get-ocular-config')} default */

import fs from 'fs';
import {resolve} from 'path';
import getAliases, {getModuleInfo} from './aliases.js';
import {shallowMerge, getValidPath, ocularRoot} from '../utils/utils.js';

/** User configuration from .ocularrc.js */
export type OcularConfig = {
  root?: string;

  aliases?: {[module: string]: string};

  nodeAliases?: {[module: string]: string};

  bundle?: {
    target?: string[];
    globalName?: string;
    format?: 'cjs' | 'esm' | 'umd' | 'iife';
    externals?: string[];
    globals?: {[pattern: string]: string};
  };

  typescript?: {
    project: string;
  };

  lint?: {
    paths?: string[];
    extensions?: string[];
  };

  entry?: {
    size?: string[] | string;
  };
};

/** Internal type to typecheck resolved ocular config inside ocular-dev-tools */
export type MaterializedOcularConfig = {
  root: string;
  ocularPath: string;
  esm: boolean;

  aliases: {[module: string]: string};

  bundle: {
    target?: string[];
    globalName?: string;
    format?: 'cjs' | 'esm' | 'umd' | 'iife';
    externals?: string[];
    globals: {[pattern: string]: string};
  };

  typescript: {
    project: string;
  };

  lint: {
    paths: string[];
    extensions: string[];
  };

  entry: {
    size: string[];
  };
};

export async function getOcularConfig(
  options: {root?: string; aliasMode?: 'src' | 'dist'} = {}
): Promise<MaterializedOcularConfig> {
  const packageRoot = options.root || process.env.PWD!;

  const IsMonorepo = fs.existsSync(resolve(packageRoot, './modules'));

  const userConfig = await getUserConfig(packageRoot);

  const config: MaterializedOcularConfig = {
    root: packageRoot,
    ocularPath: ocularRoot,

    esm: getModuleInfo(packageRoot)?.packageInfo.type === 'module',

    bundle: {
      globals: {}
    },

    typescript: {
      project: 'tsconfig.json'
    },

    lint: {
      paths: IsMonorepo ? ['modules'] : ['src'],
      extensions: ['js', 'mjs', 'jsx', 'ts', 'tsx', 'd.ts']
    },

    aliases: {},

    entry: {
      size: ['test/size.ts']
    }
  };

  shallowMerge(config, userConfig);

  // Backward compatibility
  if (typeof userConfig.entry?.size === 'string') {
    userConfig.entry.size = [userConfig.entry.size];
  }

  const aliasMode = options.aliasMode || 'src';

  // User's aliases need to come first, due to module-alias resolve order
  Object.assign(config.aliases, getAliases(aliasMode, packageRoot));

  if (aliasMode && !aliasMode.includes('browser')) {
    Object.assign(config.aliases, userConfig.nodeAliases);
  }

  return config;
}

// HELPERS

/**
 * TODO better error messages
 */
async function getUserConfig(packageRoot: string): Promise<OcularConfig> {
  const userConfigPath = getValidPath(
    resolve(packageRoot, './.ocularrc.js'),
    resolve(packageRoot, './.ocularrc.cjs'),
    resolve(packageRoot, './.ocular.config.js'),
    resolve(packageRoot, './.ocular.config.cjs'),
    // deprecated
    resolve(packageRoot, './ocular-dev-tools.config.js')
  );

  if (userConfigPath) {
    const userConfigModule = (await import(userConfigPath)) as
      | OcularConfig
      | {default: OcularConfig};
    if ('default' in userConfigModule) {
      return userConfigModule.default;
    }
    return userConfigModule;
  }

  throw new Error('No valid user config found');
}
