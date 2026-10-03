#!/usr/bin/env node

import esbuild from 'esbuild';
import {getBundleConfig, parseBundleArguments} from '../dist/configuration/get-esbuild-config.js';

const options = parseBundleArguments(process.argv.slice(2));

run();

async function run() {
  const buildConfig = await getBundleConfig(options);

  if (options.watch) {
    buildConfig.watch = true;
    await esbuild.build(buildConfig);
    // biome-ignore lint/suspicious/noConsole: Verbose mode intentionally prints bundle diagnostics.
    console.log('watching...');
  } else {
    const result = await esbuild.build(buildConfig);
    if (result.errors.length > 0) {
      process.exit(1);
    }
  }
}
