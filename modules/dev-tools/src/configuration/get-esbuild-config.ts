// / For bundles published to npm
import fs from 'fs';
import {join, dirname} from 'path';
import util from 'util';
import {getOcularConfig} from '../helpers/get-ocular-config.js';
import ext from 'esbuild-plugin-external-global';
import type {BuildOptions} from 'esbuild';

/**
 * Get list of dependencies to exclude using esbuild-plugin-external-global
 * @param externalPackages string[]
 */
// function getExternalGlobalsAMD(externalPackages) {
//   const externals = {};
//   for (const packageName of externalPackages) {
//     externals[packageName] = `typeof require === 'function' ? require('${packageName}') : null`;
//   }
//   return externals;
// }

/**
 * Get list of dependencies to exclude using esbuild-plugin-external-global
 * @param externalPackages string[]
 * @param mapping {[pattern: string]: replacement}
 */
function getExternalGlobalsIIFE(externalPackages: string[], mapping: Record<string, string>) {
  const externals: Record<string, string> = {};
  for (const packageName of externalPackages) {
    for (const key in mapping) {
      if (packageName.search(key) === 0) {
        externals[packageName] = mapping[key];
        break;
      }
    }
  }
  return externals;
}

/**
 * Removes workspace aliases that would otherwise take precedence over esbuild externals.
 * @param aliases Ocular aliases resolved for the current monorepo.
 * @param externalPackages Package names that must remain external to the bundle.
 */
function removeExternalAliases(
  aliases: Record<string, string>,
  externalPackages: string[]
): Record<string, string> {
  const filteredAliases = {...aliases};

  for (const externalPackage of externalPackages) {
    const packageName = externalPackage.endsWith('/*')
      ? externalPackage.slice(0, -2)
      : externalPackage;
    if (packageName.includes('*')) {
      continue;
    }

    for (const alias of Object.keys(filteredAliases)) {
      if (alias === packageName || alias.startsWith(`${packageName}/`)) {
        delete filteredAliases[alias];
      }
    }
  }

  return filteredAliases;
}

// esbuild does not support umd format
// Work around from https://github.com/evanw/esbuild/issues/819
// Template: https://webpack.js.org/configuration/output/#type-umd
function umdWrapper(libName: string | undefined) {
  return {
    format: 'iife',
    globalName: '__exports__',
    banner: {
      js: `\
(function webpackUniversalModuleDefinition(root, factory) {
  if (typeof exports === 'object' && typeof module === 'object')
    module.exports = factory();
  else if (typeof define === 'function' && define.amd) define([], factory);
        ${
          libName
            ? `else if (typeof exports === 'object') exports['${libName}'] = factory();
  else root['${libName}'] = factory();`
            : `else {
  var a = factory();
  for (var i in a) (typeof exports === 'object' ? exports : root)[i] = a[i];
}`
        }})(globalThis, function () {`
    },
    footer: {
      js: `\
      return __exports__;
      });`
    }
  };
}

/** Returns esbuild config for building .cjs bundles */
export async function getCJSExportConfig(opts: {
  input: string;
  output: string;
}): Promise<BuildOptions> {
  return {
    entryPoints: [opts.input],
    outfile: opts.output,
    bundle: true,
    format: 'cjs',
    // Node 16 is out of support, kept for compatibility. Move to 18?
    target: 'node16',
    packages: 'external',
    tsconfigRaw: {compilerOptions: {paths: {}}},
    sourcemap: true,
    sourcesContent: false,
    logLevel: 'info'
  };
}

export type BundleOptions = {
  input: string;
  env?: 'dev' | 'prod';
  output?: string;
  format?: 'iife' | 'cjs' | 'esm' | 'umd';
  target?: string[];
  externals?: string | string[];
  globalName?: string;
  globals?: {[pattern: string]: string};
  debug?: boolean;
  sourcemap?: boolean;
  sourcesContent?: boolean;
  watch?: boolean;
};

/** Parses command-line arguments accepted by `ocular-bundle`. */
export function parseBundleArguments(arguments_: string[]): BundleOptions {
  const options: Record<string, string | string[] | boolean | undefined> = {};

  for (const argument of arguments_) {
    if (argument.startsWith('--')) {
      const [key, ...valueParts] = argument.slice(2).split('=');
      const value = valueParts.length > 0 ? valueParts.join('=') : true;

      if (key === 'externals' || key === 'target') {
        options[key] = typeof value === 'string' ? value.split(',').filter(Boolean) : [];
      } else if (value === 'true' || value === 'false') {
        options[key] = value === 'true';
      } else {
        options[key] = value;
      }
    } else if (!options.input && argument.match(/\.(js|ts|cjs|mjs|jsx|tsx)$/)) {
      options.input = argument;
    }
  }

  if (!options.input) {
    throw new Error('ocular-bundle requires a JavaScript or TypeScript entry point');
  }

  return options as unknown as BundleOptions;
}

/** Returns esbuild config for building standalone bundles */
export async function getBundleConfig(opts: BundleOptions): Promise<BuildOptions> {
  // This script must be executed in a submodule's directory
  const packageRoot = process.cwd();
  const packageInfo = JSON.parse(fs.readFileSync(join(packageRoot, 'package.json'), 'utf-8'));
  const projectRoot = dirname(packageRoot).endsWith('modules')
    ? join(packageRoot, '../..')
    : packageRoot;

  const devMode = opts.env === 'dev';

  const ocularConfig = await getOcularConfig({
    root: projectRoot,
    aliasMode: devMode ? 'src' : 'dist'
  });

  opts = {...ocularConfig.bundle, ...opts};

  const {
    input,
    output = devMode ? './dist/dist.dev.js' : './dist.min.js',
    format = 'iife',
    target = ['esnext'],
    externals,
    globalName,
    debug,
    sourcemap = false,
    sourcesContent = true
  } = opts;

  const normalizedExternals =
    typeof externals === 'string' ? externals.split(',').filter(Boolean) : externals || [];
  const externalPackages = Object.keys(packageInfo.peerDependencies || {}).concat(
    normalizedExternals
  );

  const config: BuildOptions = {
    entryPoints: [input],
    outfile: output,
    bundle: true,
    // @ts-expect-error umd is not supported by esbuild, will be overwritten below
    format,
    minify: !devMode,
    alias: removeExternalAliases(ocularConfig.aliases, externalPackages),
    platform: 'browser',
    target,
    logLevel: 'info',
    sourcemap,
    sourcesContent,
    plugins: []
  };
  if (globalName) {
    config.globalName = globalName;
  }

  let externalGlobals: Record<string, string> | undefined;
  switch (format) {
    case 'cjs':
    case 'esm':
      // Use esbuild's built-in external functionality
      config.packages = 'external';
      if (normalizedExternals.length > 0) {
        config.external = normalizedExternals;
      }
      break;

    case 'umd':
      Object.assign(config, umdWrapper(globalName));
      externalGlobals = getExternalGlobalsIIFE(externalPackages, ocularConfig.bundle.globals);
      break;

    case 'iife':
      externalGlobals = getExternalGlobalsIIFE(externalPackages, ocularConfig.bundle.globals);
      break;

    default:
      break;
  }
  if (externalGlobals) {
    config.plugins!.unshift(ext.externalGlobalPlugin(externalGlobals));
  }

  if (debug) {
    const printableConfig = {
      ...config,
      plugins: config.plugins!.map((item) => {
        return {
          name: item.name,
          options: externalGlobals
        };
      })
    };

    // biome-ignore lint/suspicious/noConsole: Debug mode intentionally prints the resolved config.
    console.log(
      util.inspect(printableConfig, {
        showHidden: false,
        depth: null,
        colors: true
      })
    );
  }

  return config;
}
