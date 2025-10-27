import test from 'tape-promise/tape';
import {transpile, assertSourceEqual} from './test-transformer.js';
// @ts-expect-error Aliased import, remapped to valid path in esm-loader
import appendExtension from '@vis.gl/ts-plugins/ts-transform-append-extension';

const input1 = `\
export type { TypedArray } from "./types";
export { add } from "./math/add";
import vs from "../shaders/vs.glsl";
import { Shader } from "@luma.gl/core";
export { vs, Shader };`;

const input2 = `\
const throttle = await import("lodash.throttle");
const Matrix4 = import("./math/matrix4");
import("./shaders").then((modules) => { });`;

const testCases = [
  {
    title: 'add default extension to js imports',
    config: {after: true},
    input: input1,
    output: `\
export { add } from "./math/add.js";
import vs from "../shaders/vs.glsl";
import { Shader } from "@luma.gl/core";
export { vs, Shader };`
  },
  {
    title: 'add default extension to d.ts imports',
    config: {afterDeclarations: true},
    input: input1,
    output: `\
export type { TypedArray } from "./types.js";
export { add } from "./math/add.js";
import vs from "../shaders/vs.glsl";
import { Shader } from "@luma.gl/core";
export { vs, Shader };`
  },
  {
    title: 'add custom extension to js imports',
    config: {after: true, extensions: ['.mjs', '.glsl.mjs']},
    input: input1,
    output: `\
export { add } from "./math/add.mjs";
import vs from "../shaders/vs.glsl.mjs";
import { Shader } from "@luma.gl/core";
export { vs, Shader };`
  },
  {
    title: 'dynamic imports',
    config: {after: true},
    input: input2,
    output: `\
const throttle = await import("lodash.throttle");
const Matrix4 = import("./math/matrix4.js");
import("./shaders.js").then((modules) => { });`
  }
];

test('ts-transform-append-extension', (t) => {
  for (const testCase of testCases) {
    const result = transpile({
      source: testCase.input,
      transformer: appendExtension,
      config: testCase.config,
      outputType: testCase.config.afterDeclarations ? 'd.ts' : 'js'
    });

    t.is(assertSourceEqual(result, testCase.output), true, testCase.title);
  }

  t.end();
});
