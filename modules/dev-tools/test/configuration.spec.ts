import test from 'tape-promise/tape';
import {getOcularConfig} from '@vis.gl/dev-tools';

test('dev-tools#getConfig', (t) => {
  t.equals(typeof getOcularConfig, 'function');

  t.end();
});
