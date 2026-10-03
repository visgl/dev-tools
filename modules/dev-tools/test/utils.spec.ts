import {expect, test} from 'vitest';
// @ts-expect-error Aliased import
import {shallowMerge} from '@vis.gl/dev-tools/utils/utils';

test('dev-tools#utils', () => {
  expect(shallowMerge).toBeTypeOf('function');
});
