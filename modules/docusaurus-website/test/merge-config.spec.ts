import {expect, test} from 'vitest';
import {mergeConfig} from '../src/merge-config.js';

test('mergeConfig clones nested data, concatenates arrays and replaces scalar values', () => {
  const target = {nested: {left: 1}, values: [{left: 1}], replace: 'before'};
  const source = {nested: {right: 2}, values: [{right: 2}], replace: undefined};
  const result = mergeConfig(target, source) as typeof target;
  expect(result).toEqual({
    nested: {left: 1, right: 2},
    values: [{left: 1}, {right: 2}],
    replace: undefined
  });
  expect(result.nested).not.toBe(target.nested);
  expect(result.values[0]).not.toBe(target.values[0]);
  expect(result.values[1]).not.toBe(source.values[0]);
  expect(target.replace).toBe('before');
  expect(source.nested).toEqual({right: 2});
  expect(mergeConfig({value: 1}, null)).toBe(null);
  expect(mergeConfig([1], {value: 2})).toEqual({value: 2});
});

test('mergeConfig excludes prototype keys from both inputs and nested array entries', () => {
  const hostile = JSON.parse(
    '{"__proto__":{"polluted":true},"constructor":{"prototype":{"polluted":true}},"prototype":{"polluted":true},"safe":1}'
  );
  const nullPrototype = Object.assign(Object.create(null), hostile);
  const assertSafe = (value: unknown) => {
    if (!value || typeof value !== 'object') return;
    expect(Object.getPrototypeOf(value)).toBe(
      Array.isArray(value) ? Array.prototype : Object.prototype
    );
    expect('polluted' in value).toBe(false);
    for (const key of ['__proto__', 'constructor', 'prototype'])
      expect(Object.hasOwn(value, key)).toBe(false);
    for (const child of Object.values(value)) assertSafe(child);
  };
  for (const input of [hostile, nullPrototype]) {
    assertSafe(mergeConfig(input, {added: 2}));
    assertSafe(mergeConfig(Object.create(null), input));
    assertSafe(mergeConfig({nested: input, values: [input]}, {values: [input]}));
  }
  expect(Object.hasOwn(Object.prototype, 'polluted')).toBe(false);
  expect(Object.getPrototypeOf(hostile)).toBe(Object.prototype);
  expect(Object.getPrototypeOf(nullPrototype)).toBe(null);
});

test('mergeConfig copies own enumerable data properties and symbols without invoking accessors', () => {
  const symbol = Symbol('configuration');
  const getter = () => {
    throw new Error('Accessor must not execute');
  };
  const target = {[symbol]: {left: 1}, keep: 1};
  const source = {[symbol]: {right: 2}, keep: 2};
  Object.defineProperty(target, 'targetGetter', {enumerable: true, get: getter});
  Object.defineProperty(source, 'sourceGetter', {enumerable: true, get: getter});
  Object.defineProperty(source, 'hidden', {value: 3});
  const result = mergeConfig(target, source) as typeof source;
  expect(result).toEqual({[symbol]: {left: 1, right: 2}, keep: 2});
  expect(Object.hasOwn(result, 'targetGetter')).toBe(false);
  expect(Object.hasOwn(result, 'sourceGetter')).toBe(false);
  expect(Object.hasOwn(result, 'hidden')).toBe(false);
});

test('mergeConfig preserves opaque callbacks, special objects and React elements', () => {
  class Plugin {
    value = 1;
  }
  const callback = () => 1;
  const date = new Date(0);
  const regex = /configuration/;
  const plugin = new Plugin();
  const react18 = Object.freeze({$$typeof: Symbol.for('react.element'), props: {value: 1}});
  const react19 = Object.freeze({
    $$typeof: Symbol.for('react.transitional.element'),
    props: {value: 2}
  });
  const source = {callback, date, regex, plugin, react18, react19};
  const result = mergeConfig({}, source) as typeof source;
  for (const key of Object.keys(source) as (keyof typeof source)[])
    expect(result[key]).toBe(source[key]);
});

test('mergeConfig preserves array holes and ignores array accessors and iteration hooks', () => {
  const target = new Array(3);
  target[2] = {value: 1};
  const getter = () => {
    throw new Error('Array hook must not execute');
  };
  Object.defineProperty(target, 'constructor', {get: getter});
  Object.defineProperty(target, Symbol.iterator, {get: getter});
  Object.defineProperty(target, '1', {enumerable: true, get: getter});
  const result = mergeConfig(target, [2]) as unknown[];
  expect(result.length).toBe(4);
  expect(Object.hasOwn(result, '0')).toBe(false);
  expect(Object.hasOwn(result, '1')).toBe(false);
  expect(result[2]).toEqual({value: 1});
  expect(result[2]).not.toBe(target[2]);
  expect(result[3]).toBe(2);
});

test('mergeConfig rejects cyclic data while accepting repeated non-cyclic references', () => {
  const object: {self?: unknown} = {};
  object.self = object;
  const array: unknown[] = [];
  array.push(array);
  for (const value of [object, array]) {
    expect(() => mergeConfig({}, {nested: value})).toThrow(/must not contain cycles/);
    expect(() => mergeConfig({nested: value}, {})).toThrow(/must not contain cycles/);
  }
  const shared = {value: 1};
  const result = mergeConfig({}, {left: shared, right: shared}) as {left: object; right: object};
  expect(result).toEqual({left: {value: 1}, right: {value: 1}});
  expect(result.left).not.toBe(shared);
  expect(result.right).not.toBe(shared);
  expect(mergeConfig(shared, shared)).toEqual(shared);
});

test('mergeConfig remains data-only when descriptor fields are inherited from a polluted prototype', () => {
  const source = {safe: {value: 1}};
  const getter = () => {
    throw new Error('Accessor must not execute');
  };
  Object.defineProperty(source, 'accessor', {enumerable: true, get: getter});
  Object.defineProperty(source, '$$typeof', {enumerable: true, get: getter});
  const keys = ['value', 'get', 'set'];
  const previous = keys.map(
    (key) => [key, Object.getOwnPropertyDescriptor(Object.prototype, key)] as const
  );
  let result: unknown;
  try {
    Object.defineProperties(Object.prototype, {
      value: {value: Symbol.for('react.element'), configurable: true},
      get: {value: getter, configurable: true},
      set: {value: getter, configurable: true}
    });
    result = mergeConfig({}, source);
  } finally {
    for (const key of keys) Reflect.deleteProperty(Object.prototype, key);
    for (const [key, property] of previous) {
      if (property) Object.defineProperty(Object.prototype, key, property);
    }
  }
  expect(result).toEqual({safe: {value: 1}});
  expect(result === source).toBe(false);
  expect(Object.hasOwn(result as object, 'accessor')).toBe(false);
  expect(Object.hasOwn(result as object, '$$typeof')).toBe(false);
});
