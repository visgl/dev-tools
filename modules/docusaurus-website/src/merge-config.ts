const unsafeKeys = new Set(['__proto__', 'constructor', 'prototype']);
const reactTags = new Set([Symbol.for('react.element'), Symbol.for('react.transitional.element')]);

function isRecord(value: unknown): value is Record<PropertyKey, unknown> {
  if (!value || typeof value !== 'object') return false;
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return false;
  const tag = Object.getOwnPropertyDescriptor(value, '$$typeof');
  return !tag || !Object.hasOwn(tag, 'value') || !reactTags.has(tag.value);
}

function ownData(value: object): [PropertyKey, unknown][] {
  const entries: [PropertyKey, unknown][] = [];
  for (const key of Reflect.ownKeys(value)) {
    if (typeof key === 'string' && unsafeKeys.has(key)) continue;
    const property = Object.getOwnPropertyDescriptor(value, key);
    if (property?.enumerable && Object.hasOwn(property, 'value'))
      entries.push([key, property.value]);
  }
  return entries;
}

function setOwn(target: object, key: PropertyKey, value: unknown) {
  const property: PropertyDescriptor = Object.create(null);
  property.value = value;
  property.enumerable = true;
  property.configurable = true;
  property.writable = true;
  Object.defineProperty(target, key, property);
}

function visit<T>(value: object, ancestors: Set<object>, callback: () => T): T {
  if (ancestors.has(value)) throw new TypeError('Configuration values must not contain cycles');
  ancestors.add(value);
  try {
    return callback();
  } finally {
    ancestors.delete(value);
  }
}

function clone(value: unknown, ancestors: Set<object>): unknown {
  if (Array.isArray(value)) {
    return visit(value, ancestors, () => {
      const result = new Array(value.length);
      for (const [key, entry] of ownData(value)) {
        if (
          typeof key === 'string' &&
          String(Number(key)) === key &&
          Number.isInteger(Number(key)) &&
          Number(key) >= 0 &&
          Number(key) < value.length
        ) {
          setOwn(result, key, clone(entry, ancestors));
        }
      }
      return result;
    });
  }
  if (!isRecord(value)) return value;
  return visit(value, ancestors, () => {
    const result = {};
    for (const [key, entry] of ownData(value)) setOwn(result, key, clone(entry, ancestors));
    return result;
  });
}

function merge(target: unknown, source: unknown, left: Set<object>, right: Set<object>): unknown {
  if (Array.isArray(target) && Array.isArray(source)) {
    return (clone(target, left) as unknown[]).concat(clone(source, right) as unknown[]);
  }
  if (!isRecord(target) || !isRecord(source)) return clone(source, right);
  return visit(target, left, () =>
    visit(source, right, () => {
      const result = {};
      const properties = new Map(ownData(target));
      for (const [key, value] of properties) setOwn(result, key, clone(value, left));
      for (const [key, value] of ownData(source)) {
        setOwn(
          result,
          key,
          properties.has(key) ? merge(properties.get(key), value, left, right) : clone(value, right)
        );
      }
      return result;
    })
  );
}

/**
 * Merge configuration data: clone plain records, concatenate arrays, and replace other values.
 * Preserve callbacks, class instances and React elements as opaque values. Ignore inherited,
 * non-enumerable, accessor and prototype-related properties; reject cycles in configuration data.
 */
export function mergeConfig(target: unknown, source: unknown): unknown {
  return merge(target, source, new Set(), new Set());
}
