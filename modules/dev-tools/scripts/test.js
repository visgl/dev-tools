#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {spawnSync} from 'node:child_process';
import {fileURLToPath, pathToFileURL} from 'node:url';

const packageDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(pathToFileURL(path.resolve(packageDirectory, 'package.json')));
const arguments_ = process.argv.slice(2);

if (arguments_[0] === 'help' || arguments_[0] === '--help') {
  printUsage();
  process.exit(0);
}

// Project names precede Vitest options so each positional value can become a --project flag.
const optionIndex = arguments_.findIndex((argument) => argument.startsWith('-'));
const projects = arguments_.slice(0, optionIndex === -1 ? arguments_.length : optionIndex);
const vitestArguments = optionIndex === -1 ? [] : arguments_.slice(optionIndex);

if (projects.length === 0) {
  printUsage();
  process.exit(1);
}

// Resolve Vitest from dev-tools so consumers only need this package on their PATH.
const vitestPackagePath = require.resolve('vitest/package.json');
const vitestPackage = JSON.parse(fs.readFileSync(vitestPackagePath, 'utf8'));
const vitestExecutable = path.resolve(path.dirname(vitestPackagePath), vitestPackage.bin.vitest);
const result = spawnSync(
  process.execPath,
  [
    vitestExecutable,
    'run',
    ...projects.flatMap((project) => ['--project', project]),
    ...vitestArguments
  ],
  {
    cwd: process.cwd(),
    stdio: 'inherit'
  }
);

process.exit(result.status ?? 1);

function printUsage() {
  console.log('Usage: ocular-test <project...> [vitest options]');
}
