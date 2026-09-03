import {expect, test} from 'vitest';
import {transpile, assertSourceEqual} from './test-transformer.js';
// @ts-expect-error Aliased import, remapped to valid path in esm-loader
import inlineConstants from '@vis.gl/ts-plugins/ts-transform-inline-webgl-constants';

const testCases = [
  {
    title: 'drop GL import',
    input: `\
import {GL} from '@luma.gl/webgl/constants';

device.setParametersWebGL({
  blendFunc: [GL.ONE, GL.ONE_MINUS_DST_COLOR, GL.SRC_ALPHA, GL.DST_ALPHA]
});
`,
    output: `\
device.setParametersWebGL({
  blendFunc: [1, 775, 770, 772]
});
export {};
`
  },
  {
    title: 'retain other named imports',
    input: `\
import {GL, OTHER_CONSTANT} from '@luma.gl/webgl/constants';

console.log(GL.TRIANGLES, OTHER_CONSTANT);
`,
    output: `\
import { OTHER_CONSTANT } from '@luma.gl/webgl/constants';
console.log(4, OTHER_CONSTANT);
`
  },
  {
    title: 'retain GL import for dynamic access',
    input: `\
import {GL} from '@luma.gl/webgl/constants';

const name = 'TRIANGLES';
console.log(GL[name]);
`,
    output: `\
import { GL } from '@luma.gl/webgl/constants';
const name = 'TRIANGLES';
console.log(GL[name]);
`
  },
  {
    title: 'retain GL import for direct access',
    input: `\
import {GL} from '@luma.gl/webgl/constants';

console.log(GL);
`,
    output: `\
import { GL } from '@luma.gl/webgl/constants';
console.log(GL);
`
  },
  {
    title: 'drop GL import when remaining references are types',
    input: `\
import {GL, GLPrimitiveTopology, type GLTextureTarget} from '@luma.gl/webgl/constants';

export function getTriangleMode(topology: GLPrimitiveTopology): GLTextureTarget | GL.TRIANGLES {
  return GL.TRIANGLES;
}
`,
    output: `\
export function getTriangleMode(topology) {
  return 4;
}
`
  },
  {
    title: 'gl constants replaced',
    input: `gl.getParameter(gl.CULL_FACE_MODE);`,
    output: `gl.getParameter(2885);`
  },
  {
    title: 'static property replaced',
    input: `console.log(GL['TRIANGLES']);`,
    output: `console.log(4);`
  },
  {
    title: 'dynamic property not replaced',
    input: `\
const name = 'TRIANGLES';
console.log(GL[name]);
`,
    output: `\
const name = 'TRIANGLES';
console.log(GL[name]);
`
  }
];

test('ts-transform-inline-webgl-constants', () => {
  for (const testCase of testCases) {
    const result = transpile({
      source: testCase.input,
      transformer: inlineConstants,
      config: {}
    });

    expect(assertSourceEqual(result, testCase.output), testCase.title).toBe(true);
  }
});
