import test from 'tape-promise/tape';
import ts from 'typescript';
import type {PluginConfig} from 'ts-patch';
import {transpile, assertSourceEqual} from './test-transformer.js';
// @ts-expect-error Aliased import, remapped to valid path in esm-loader
import transformWebGPU from '@vis.gl/ts-plugins/ts-transform-webgpu';

test('ts-transform-webgpu: strips WebGPU code', (t) => {
  const result = transpileWithProgram({
    source: `\
const plain = \`keep me\`;
const shader = /* wgsl */ \`shader source\`;
const interpolated = /* wgsl */ \`shader \${plain}\`;
const supported = __WEBGPU_ENABLED;
const direct = device.type === 'webgpu' ? 'webgpu' : 'webgl';
const nested = context.device.type === 'webgpu';
const isWebGPU = false;
const backend = isWebGPU ? 'webgpu' : 'webgl';
`,
    transformer: transformWebGPU,
    config: {webGPUEnabled: false}
  });

  t.is(
    assertSourceEqual(
      result,
      `\
const plain = \`keep me\`;
const shader = null;
const interpolated = null;
const supported = false;
const direct = 'webgl';
const nested = false;
const isWebGPU = false;
const backend = 'webgl';
`
    ),
    true
  );
  t.end();
});

function transpileWithProgram({
  source,
  transformer,
  config
}: {
  source: string;
  transformer: Function;
  config: PluginConfig;
}): string {
  const fileName = '/test.ts';
  const compilerOptions: ts.CompilerOptions = {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ESNext
  };
  const sourceFile = ts.createSourceFile(
    fileName,
    source,
    ts.ScriptTarget.ESNext,
    true,
    ts.ScriptKind.TS
  );
  const host = ts.createCompilerHost(compilerOptions);
  const getSourceFile = host.getSourceFile.bind(host);
  host.getSourceFile = (requestedFileName, languageVersion, ...args) =>
    requestedFileName === fileName
      ? sourceFile
      : getSourceFile(requestedFileName, languageVersion, ...args);
  host.fileExists = (requestedFileName) =>
    requestedFileName === fileName || ts.sys.fileExists(requestedFileName);
  host.readFile = (requestedFileName) =>
    requestedFileName === fileName ? source : ts.sys.readFile(requestedFileName);

  const program = ts.createProgram([fileName], compilerOptions, host);
  let output = '';
  program.emit(
    undefined,
    (outputFileName, text) => {
      if (outputFileName.endsWith('.js')) {
        output = text;
      }
    },
    undefined,
    false,
    {
      before: [transformer(program, config, {ts})]
    }
  );
  return output;
}

test('ts-transform-webgpu: preserves WebGPU code', (t) => {
  const result = transpile({
    source: `\
const shader = /* wgsl */ \`shader source\`;
const supported = __WEBGPU_ENABLED;
const backend = supported ? 'webgpu' : 'webgl';
`,
    transformer: transformWebGPU,
    config: {webGPUEnabled: true}
  });

  t.is(
    assertSourceEqual(
      result,
      `\
const shader = /* wgsl */ \`shader source\`;
const supported = true;
const backend = supported ? 'webgpu' : 'webgl';
`
    ),
    true
  );
  t.end();
});

test('ts-transform-webgpu: replaces WGSL module exports', (t) => {
  const result = transpile({
    sourceFileName: 'shader.wgsl.ts',
    source: `\
export const source = \`shader source\`;
export function getShader() {
  return source;
}
export default function createShader() {
  return source;
}
export type ShaderOptions = {enabled: boolean};
export interface ShaderModule {
  source: string;
}
`,
    transformer: transformWebGPU,
    config: {webGPUEnabled: false}
  });

  t.is(
    assertSourceEqual(
      result,
      `\
export const source = null;
export const getShader = () => null;
export default () => null;
`
    ),
    true
  );
  t.end();
});
