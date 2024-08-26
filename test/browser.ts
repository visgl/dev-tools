import test from 'tape';

// @ts-ignore TS2339: Property 'browserTestDriver_finish' does not exist on type 'Window & typeof globalThis'
test.onFinish(window.browserTestDriver_finish);
// @ts-ignore TS2339: Property 'browserTestDriver_fail' does not exist on type 'Window & typeof globalThis'
test.onFailure(window.browserTestDriver_fail);

test('No tests', t => {
  t.comment('dev-tools tests are not meant to run in the browser');
  t.end();
});
