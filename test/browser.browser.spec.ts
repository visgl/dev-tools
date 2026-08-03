import {expect, test} from 'vitest';

test('browser project runs in a browser', () => {
  expect(globalThis.window).toBeDefined();
  expect(window.document).toBeDefined();
});
