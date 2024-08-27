import test from 'tape-promise/tape';
// @ts-expect-error Aliased import
import {getCustomId} from '@vis.gl/docusaurus-website/write-heading-ids';

test('write-heading-ids', (t) => {
  const testCases = [
    {
      input: `The line width of each object, in units specified by widthUnits (default pixels). `,
      output: undefined,
      title: 'not header'
    },
    {
      input: `## Learning deck.gl`,
      output: undefined,
      title: 'does not contain code'
    },
    {
      input: `## Changes to \`TileLayer\``,
      output: undefined,
      title: 'is not api'
    },
    {
      input: `## \`pickObjects\``,
      output: '{#pickobjects}',
      title: 'single word api'
    },
    {
      input: `## \`@deck.gl/extensions\``,
      output: undefined,
      title: 'Package name'
    },
    {
      input: `## \`strokeOpacity\` (Number)`,
      output: '{#strokeopacity}',
      title: 'with type annotation 1'
    },
    {
      input: `## \`backgroundPadding:number[]\``,
      output: '{#backgroundpadding}',
      title: 'with type annotation 2'
    },
    {
      input: `## \`onBeforeRender(gl: WebGLRenderingContext)\``,
      output: '{#onbeforerender}',
      title: 'with call signature'
    },
    {
      input: `##### \`getWidth\` ([Function](../../developer-guide/using-layers.md#accessors)|Number, optional) ![transition-enabled](https://img.shields.io/badge/transition-enabled-green.svg?style=flat-square")`,
      output: '{#getwidth}',
      title: 'with extra flag'
    }
  ];

  for (const testCase of testCases) {
    t.is(getCustomId(testCase.input)?.[2], testCase.output, testCase.title);
  }

  t.end();
});
