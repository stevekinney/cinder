import { expect, test } from 'bun:test';
import { requiredInstance, requiredValue } from './required-value.ts';

test('requires a present result without rejecting false or empty values', () => {
  expect(requiredValue(0)).toBe(0);
  expect(requiredValue(false)).toBe(false);
  expect(requiredValue('')).toBe('');
  const entry = { id: 'fixture' };
  expect(requiredValue(entry)).toBe(entry);
  expect(() => requiredValue(undefined)).toThrow('Expected a present test result or fixture entry');
  expect(() => requiredValue(null)).toThrow('Expected a present test result or fixture entry');
});

test('requires an actual instance and retains its identity and type', () => {
  const value = new Date('2026-09-16T00:00:00Z');
  const candidate: unknown = value;
  const result = requiredInstance(candidate, Date);
  expect(result).toBe(value);
  expect(result.getUTCFullYear()).toBe(2026);
});

test('rejects absent values, different instances, and matching object shapes', () => {
  expect(() => requiredInstance(null, Date)).toThrow('Expected an instance of Date');
  expect(() => requiredInstance(undefined, Date)).toThrow('Expected an instance of Date');
  expect(() => requiredInstance(new Map(), Date)).toThrow('Expected an instance of Date');
  expect(() => requiredInstance({ getUTCFullYear: () => 2026 }, Date)).toThrow(
    'Expected an instance of Date',
  );
});
