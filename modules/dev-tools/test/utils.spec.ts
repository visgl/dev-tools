import test from 'tape-promise/tape';
// @ts-expect-error Aliased import
import {shallowMerge} from '@vis.gl/dev-tools/utils/utils';

test('dev-tools#utils', (t) => {
  t.equals(typeof shallowMerge, 'function');

  t.end();
});
