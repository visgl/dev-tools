import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import ts from 'typescript';
import {
  transformOutput,
  loadConstants,
  type OutputPlugin
} from '@vis.gl/ts-plugins/output-transforms';
import remapping from '@ampproject/remapping';

export async function nativeBuild(project: string) {
  const configPath = path.resolve(project);
  const config = ts.readConfigFile(configPath, ts.sys.readFile);
  if (config.error)
    throw new Error(ts.flattenDiagnosticMessageText(config.error.messageText, '\n'));
  const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, path.dirname(configPath));
  const plugins = (parsed.options.plugins ?? []) as OutputPlugin[];
  if (parsed.options.outFile)
    throw new Error('Native builds do not support outFile; emit separate modules instead');
  // Match the CLI overrides while retaining the actual input-to-output association.
  // Debugger sourceRoot URLs are not local filesystem paths.
  Object.assign(parsed.options, {
    configFilePath: configPath,
    outDir: path.resolve('dist'),
    declaration: true,
    declarationMap: true,
    sourceMap: true,
    incremental: false,
    composite: false
  });
  const supported = new Set([
    'ts-transform-version-inline',
    'ts-transform-inline-webgl-constants',
    'ts-transform-remove-glsl-comments',
    'ts-transform-append-extension'
  ]);
  for (const plugin of plugins) {
    if (plugin.transform && !supported.has(plugin.transform.split('/').pop()!))
      throw new Error(`Native build does not support transformer ${plugin.transform}`);
  }
  const require = createRequire(path.join(process.cwd(), 'package.json'));
  const constants = loadConstants(plugins, configPath);
  const manifestPath = require.resolve('typescript/package.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  if (Number(manifest.version.split('.')[0]) < 7)
    throw new Error('Native builds require TypeScript >= 7 in the consuming project');
  const executable = path.resolve(path.dirname(manifestPath), manifest.bin.tsc);
  // Re-emit all files: incremental builds must not leave a mixture of transformed and raw output.
  const result = spawnSync(
    process.execPath,
    [
      executable,
      '--project',
      configPath,
      '--declaration',
      '--declarationMap',
      '--sourceMap',
      '--outDir',
      'dist',
      '--incremental',
      'false',
      '--composite',
      'false',
      '--listEmittedFiles',
      '--listFiles',
      '--pretty',
      String(Boolean(process.stdout.isTTY))
    ],
    {stdio: ['inherit', 'pipe', 'inherit'], encoding: 'utf8', maxBuffer: 64 * 1024 * 1024}
  );
  const lines = (result.stdout ?? '').split(/\r?\n/);
  const inputs = lines.filter((line) => path.isAbsolute(line) && fs.existsSync(line));
  const inputSet = new Set(inputs);
  const diagnostics = lines
    .filter((line) => !line.startsWith('TSFILE: ') && !inputSet.has(line))
    .join('\n');
  if (diagnostics.trim()) process.stdout.write(diagnostics);
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`TypeScript exited with status ${result.status}`);
  // Include imported inputs even when tsconfig lists only a single entry file.
  parsed.fileNames = inputs;
  const sourcesByOutput = new Map<string, string>();
  for (const sourceFileName of parsed.fileNames) {
    for (const outputFileName of ts.getOutputFileNames(
      parsed,
      sourceFileName,
      !ts.sys.useCaseSensitiveFileNames
    )) {
      sourcesByOutput.set(path.resolve(outputFileName), sourceFileName);
    }
  }
  const emittedFiles = result.stdout
    .split(/\r?\n/)
    .filter((line) => line.startsWith('TSFILE: '))
    .map((line) => path.resolve(line.slice('TSFILE: '.length)));
  for (const fileName of emittedFiles) {
    if (!/\.(?:[cm]?js|jsx|d\.[cm]?ts)$/.test(fileName)) continue;
    const original = fs.readFileSync(fileName, 'utf8');
    const mapPath = `${fileName}.map`;
    const previous = fs.existsSync(mapPath)
      ? JSON.parse(fs.readFileSync(mapPath, 'utf8'))
      : undefined;
    const sourceFileName = sourcesByOutput.get(fileName);
    if (!sourceFileName)
      throw new Error(`Cannot identify the input source for emitted file ${fileName}`);
    const transformed = transformOutput(original, fileName, plugins, constants, sourceFileName);
    if (transformed.code === original) continue;
    if (previous) {
      const combined = remapping([JSON.parse(transformed.map.toString()), previous], () => null);
      combined.file = path.basename(fileName);
      fs.writeFileSync(mapPath, JSON.stringify(combined));
    }
    fs.writeFileSync(fileName, transformed.code);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await nativeBuild(process.argv[2] || 'tsconfig.json');
}
