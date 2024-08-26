import test from 'tape-promise/tape';
// @ts-expect-error Aliased import
import {getESLintConfig, getPrettierConfig} from '@vis.gl/dev-tools/configuration';

test('dev-tools#getConfig', (t) => {
  let config = getESLintConfig();
  t.equals(typeof config, 'object');

  config = getPrettierConfig();
  t.equals(typeof config, 'object');

  t.end();
});
