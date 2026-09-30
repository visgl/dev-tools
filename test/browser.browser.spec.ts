import {expect, test, vi} from 'vitest';
import {getBrowserFixtureValue} from './fixtures/browser-module.js';

vi.mock('./fixtures/browser-module.js');

test('browser project runs in a browser', () => {
  expect(globalThis.window).toBeDefined();
  expect(window.document).toBeDefined();
});

test('browser project intercepts module imports with the shared Playwright provider', () => {
  expect(vi.isMockFunction(getBrowserFixtureValue)).toBe(true);
  expect(getBrowserFixtureValue()).toBeUndefined();

  vi.mocked(getBrowserFixtureValue).mockReturnValue('mocked');
  expect(getBrowserFixtureValue()).toBe('mocked');
});
