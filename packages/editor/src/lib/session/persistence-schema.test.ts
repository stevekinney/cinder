import { describe, expect, test } from 'bun:test';
import { validateSessionSchema } from './persistence.js';

import { createValidPersistedSession, installStorageFixture } from './persistence-test-support.ts';
installStorageFixture();

describe('validateSessionSchema', () => {
  test('returns true for valid session', () => {
    const data = createValidPersistedSession();
    expect(validateSessionSchema(data)).toBe(true);
  });

  test('returns true for session with all optional fields', () => {
    const data = createValidPersistedSession({
      outcome: 'approve',
      submittedAt: '2024-01-02T00:00:00.000Z',
    });
    expect(validateSessionSchema(data)).toBe(true);
  });

  test('returns false for null', () => {
    expect(validateSessionSchema(null)).toBe(false);
  });

  test('returns false for non-object', () => {
    expect(validateSessionSchema('string')).toBe(false);
    expect(validateSessionSchema(123)).toBe(false);
    expect(validateSessionSchema([])).toBe(false);
  });

  test('returns false for missing id', () => {
    const data = { ...createValidPersistedSession() };
    Reflect.deleteProperty(data, 'id');
    expect(validateSessionSchema(data)).toBe(false);
  });

  test('returns false for missing status', () => {
    const data = { ...createValidPersistedSession() };
    Reflect.deleteProperty(data, 'status');
    expect(validateSessionSchema(data)).toBe(false);
  });

  test('returns false for invalid status', () => {
    const data = createValidPersistedSession();
    Reflect.set(data, 'status', 'invalid');
    expect(validateSessionSchema(data)).toBe(false);
  });

  test('returns false for invalid outcome', () => {
    const data = createValidPersistedSession();
    Reflect.set(data, 'outcome', 'invalid');
    expect(validateSessionSchema(data)).toBe(false);
  });

  test('returns false for missing startedAt', () => {
    const data = { ...createValidPersistedSession() };
    Reflect.deleteProperty(data, 'startedAt');
    expect(validateSessionSchema(data)).toBe(false);
  });

  test('returns false for missing updatedAt', () => {
    const data = { ...createValidPersistedSession() };
    Reflect.deleteProperty(data, 'updatedAt');
    expect(validateSessionSchema(data)).toBe(false);
  });

  test('returns false for missing draftComments', () => {
    const data = { ...createValidPersistedSession() };
    Reflect.deleteProperty(data, 'draftComments');
    expect(validateSessionSchema(data)).toBe(false);
  });

  test('returns false for non-array draftComments', () => {
    const data = createValidPersistedSession();
    Reflect.set(data, 'draftComments', 'not-array');
    expect(validateSessionSchema(data)).toBe(false);
  });

  test('returns false for non-string submittedAt', () => {
    const data = createValidPersistedSession();
    Reflect.set(data, 'submittedAt', 123);
    expect(validateSessionSchema(data)).toBe(false);
  });

  test('accepts all valid outcomes', () => {
    expect(validateSessionSchema(createValidPersistedSession({ outcome: 'approve' }))).toBe(true);
    expect(validateSessionSchema(createValidPersistedSession({ outcome: 'request_changes' }))).toBe(
      true,
    );
    expect(validateSessionSchema(createValidPersistedSession({ outcome: 'comment' }))).toBe(true);
  });

  test('accepts both valid statuses', () => {
    expect(validateSessionSchema(createValidPersistedSession({ status: 'drafting' }))).toBe(true);
    expect(validateSessionSchema(createValidPersistedSession({ status: 'submitted' }))).toBe(true);
  });
});
