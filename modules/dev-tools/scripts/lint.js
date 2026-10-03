#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {fileURLToPath, pathToFileURL} from 'node:url';

import {getOcularConfig} from '../dist/helpers/get-ocular-config.js';

const packageDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(pathToFileURL(path.resolve(packageDirectory, 'package.json')));
const projectDirectory = process.cwd();
const mode = process.argv[2];
const extraArguments = process.argv.slice(mode === 'fix' || mode === 'pre-commit' ? 3 : 2);
const ocularConfig = await getOcularConfig({root: projectDirectory});

if (mode === 'help') {
  printUsage();
  process.exit(0);
}

const targetPaths =
  mode === 'pre-commit' ? getChangedFiles() : ocularConfig.lint.paths.filter(fs.existsSync);

if (targetPaths.length > 0) {
  const configPath = getConfigPath();
  const arguments_ = [
    'check',
    mode === 'fix' ? '--write' : undefined,
    '--files-ignore-unknown=true',
    '--no-errors-on-unmatched',
    '--diagnostic-level=error',
    '--reporter=summary',
    `--config-path=${configPath}`,
    ...extraArguments,
    ...targetPaths
  ].filter(Boolean);

  runBiome(arguments_);
}

validateLockfile();

function getConfigPath() {
  for (const fileName of ['biome.json', 'biome.jsonc']) {
    const configPath = path.resolve(projectDirectory, fileName);
    if (fs.existsSync(configPath)) {
      return configPath;
    }
  }

  // Preserve ocular-lint's zero-config behavior for existing consumers.
  return path.resolve(packageDirectory, 'src/configuration/biome.jsonc');
}

function getChangedFiles() {
  const result = spawnSync('git', ['diff', 'HEAD', '--name-only', '--diff-filter=ACMR'], {
    cwd: projectDirectory,
    encoding: 'utf8'
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }

  const lintRoots = ocularConfig.lint.paths.map((lintPath) =>
    path.normalize(lintPath).replace(/[\\/]$/, '')
  );
  return result.stdout
    .split(/\r?\n/)
    .filter(Boolean)
    .filter((fileName) => lintRoots.some((lintRoot) => isWithinRoot(fileName, lintRoot)))
    .filter((fileName) => fs.existsSync(path.resolve(projectDirectory, fileName)));
}

function isWithinRoot(fileName, root) {
  const normalizedFileName = path.normalize(fileName);
  return normalizedFileName === root || normalizedFileName.startsWith(`${root}${path.sep}`);
}

function runBiome(arguments_) {
  // Resolve the dependency relative to dev-tools so consumers do not need their own Biome install.
  const biomeExecutable = require.resolve('@biomejs/biome/bin/biome');
  const result = spawnSync(process.execPath, [biomeExecutable, ...arguments_], {
    cwd: projectDirectory,
    stdio: 'inherit'
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function validateLockfile() {
  const lockfilePath = path.resolve(projectDirectory, 'yarn.lock');
  if (!fs.existsSync(lockfilePath)) {
    return;
  }
  if (fs.readFileSync(lockfilePath, 'utf8').includes('unpm.u')) {
    console.error('Please rebuild yarn.lock using a public npm registry.');
    process.exit(1);
  }
  console.log('Lockfile valid.');
}

function printUsage() {
  console.log(`ocular-lint [fix | pre-commit]

Run Biome formatting and lint checks over the paths configured by lint.paths.

  fix         Apply safe lint fixes and formatting changes.
  pre-commit  Check tracked files changed relative to HEAD.`);
}
