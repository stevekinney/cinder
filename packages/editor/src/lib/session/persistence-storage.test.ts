import { describe, expect, mock, spyOn, test } from 'bun:test';
import {
  STORAGE_KEY_PREFIX,
  clearAllPersistedSessions,
  clearPersistedSession,
  hasPersistedSession,
  listPersistedSessions,
} from './persistence.js';

import {
  createMockStorage,
  installStorageFixture,
  stubGlobal,
} from './persistence-test-support.ts';
const fixture = installStorageFixture();

describe('clearPersistedSession', () => {
  test('removes session from sessionStorage', () => {
    clearPersistedSession('doc-123');

    expect(fixture.storage.removeItem).toHaveBeenCalledWith(`${STORAGE_KEY_PREFIX}doc-123`);
  });

  test('handles storage errors gracefully', () => {
    const diagnostic = spyOn(console, 'warn').mockImplementation(() => {});
    try {
      fixture.storage.removeItem.mockImplementationOnce(() => {
        throw new Error('Storage unavailable');
      });

      // Should not throw
      expect(() => clearPersistedSession('doc-123')).not.toThrow();

      expect(diagnostic).toHaveBeenCalledTimes(1);
      expect(diagnostic).toHaveBeenCalledWith(
        'Failed to clear review session:',
        new Error('Storage unavailable'),
      );
    } finally {
      diagnostic.mockRestore();
    }
  });
});

describe('hasPersistedSession', () => {
  test('returns true when session exists', () => {
    fixture.storage.getItem.mockReturnValueOnce('{}');

    expect(hasPersistedSession('doc-123')).toBe(true);
  });

  test('returns false when session does not exist', () => {
    fixture.storage.getItem.mockReturnValueOnce(null);

    expect(hasPersistedSession('doc-123')).toBe(false);
  });

  test('handles storage errors gracefully', () => {
    fixture.storage.getItem.mockImplementationOnce(() => {
      throw new Error('Storage unavailable');
    });

    expect(hasPersistedSession('doc-123')).toBe(false);
  });
});

describe('listPersistedSessions', () => {
  test('returns empty array when no sessions', () => {
    expect(listPersistedSessions()).toEqual([]);
  });

  test('returns document keys for matching sessions', () => {
    // Setup mock storage with some keys
    const mockKeys = [`${STORAGE_KEY_PREFIX}doc-1`, `${STORAGE_KEY_PREFIX}doc-2`, 'other-key'];
    fixture.storage = createMockStorage({ keys: mockKeys });
    stubGlobal('sessionStorage', fixture.storage);

    const result = listPersistedSessions();

    expect(result).toEqual(['doc-1', 'doc-2']);
  });

  test('filters out non-matching keys', () => {
    const mockKeys = ['other-key-1', 'other-key-2'];
    fixture.storage = createMockStorage({ keys: mockKeys });
    stubGlobal('sessionStorage', fixture.storage);

    expect(listPersistedSessions()).toEqual([]);
  });

  test('handles storage errors gracefully', () => {
    const throwingStorage = createMockStorage({ throwOnLength: true });
    stubGlobal('sessionStorage', throwingStorage);

    expect(listPersistedSessions()).toEqual([]);
  });
});

describe('clearAllPersistedSessions', () => {
  test('clears all review session keys', () => {
    const mockKeys = [`${STORAGE_KEY_PREFIX}doc-1`, `${STORAGE_KEY_PREFIX}doc-2`, 'other-key'];
    fixture.storage = createMockStorage({ keys: mockKeys, removeItem: mock(() => {}) });
    stubGlobal('sessionStorage', fixture.storage);

    clearAllPersistedSessions();

    expect(fixture.storage.removeItem).toHaveBeenCalledTimes(2);
    expect(fixture.storage.removeItem).toHaveBeenCalledWith(`${STORAGE_KEY_PREFIX}doc-1`);
    expect(fixture.storage.removeItem).toHaveBeenCalledWith(`${STORAGE_KEY_PREFIX}doc-2`);
  });

  test('handles storage errors gracefully', () => {
    const throwingStorage = createMockStorage({ throwOnLength: true });
    stubGlobal('sessionStorage', throwingStorage);

    // Should not throw
    expect(() => clearAllPersistedSessions()).not.toThrow();
  });
});
