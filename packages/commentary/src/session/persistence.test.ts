// @ts-nocheck -- migrated commentary assertions use runtime-verified fixture indexing.
import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test';
import type { CommentAnchor } from '../comments/types.js';
import {
  STORAGE_KEY_PREFIX,
  clearAllPersistedSessions,
  clearPersistedSession,
  getStorageKey,
  hasPersistedSession,
  listPersistedSessions,
  loadSession,
  saveSession,
  validateSessionSchema,
} from './persistence.js';
import type { PersistedReviewSession, ReviewSession } from './types.js';

// ============================================================================
// Mock Setup
// ============================================================================

// Create a mock sessionStorage
type MockStorageOptions = {
  keys?: readonly string[];
  removeItem?: Storage['removeItem'];
  throwOnLength?: boolean;
};

function createMockStorage(options: MockStorageOptions = {}): Storage {
  let store: Record<string, string> = {};
  return {
    getItem: mock((key: string) => store[key] ?? null),
    setItem: mock((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem:
      options.removeItem ??
      mock((key: string) => {
        delete store[key];
      }),
    clear: mock(() => {
      store = {};
    }),
    key: mock((index: number) => options.keys?.[index] ?? Object.keys(store)[index] ?? null),
    get length() {
      if (options.throwOnLength) {
        throw new Error('Storage unavailable');
      }
      return options.keys?.length ?? Object.keys(store).length;
    },
  };
}

let mockStorage: Storage;
const originalWindow = globalThis.window;
const originalSessionStorage = globalThis.sessionStorage;

function stubGlobal(name: 'window' | 'sessionStorage', value: unknown): void {
  Object.defineProperty(globalThis, name, {
    value,
    configurable: true,
    writable: true,
  });
}

function restoreGlobal(name: 'window' | 'sessionStorage', value: unknown): void {
  if (value === undefined) {
    Reflect.deleteProperty(globalThis, name);
    return;
  }

  Object.defineProperty(globalThis, name, {
    value,
    configurable: true,
    writable: true,
  });
}

function restoreGlobals(): void {
  restoreGlobal('window', originalWindow);
  restoreGlobal('sessionStorage', originalSessionStorage);
  mock.restore();
}

beforeEach(() => {
  mockStorage = createMockStorage();
  stubGlobal('window', globalThis);
  stubGlobal('sessionStorage', mockStorage);
});

afterEach(() => {
  restoreGlobals();
});

// ============================================================================
// Test Fixtures
// ============================================================================

function createTestAnchor(overrides?: Partial<CommentAnchor>): CommentAnchor {
  return {
    quote: 'test quote',
    prefix: 'prefix ',
    suffix: ' suffix',
    from: 10,
    to: 20,
    status: 'anchored',
    ...overrides,
  };
}

function createTestSession(overrides?: Partial<ReviewSession>): ReviewSession {
  return {
    id: 'session-1',
    status: 'drafting',
    draftComments: [],
    startedAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function createValidPersistedSession(
  overrides?: Partial<PersistedReviewSession>,
): PersistedReviewSession {
  return {
    id: 'session-1',
    status: 'drafting',
    draftComments: [],
    startedAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    ...overrides,
  };
}

// ============================================================================
// Storage Key
// ============================================================================

describe('getStorageKey', () => {
  test('prepends prefix to document key', () => {
    expect(getStorageKey('doc-123')).toBe(`${STORAGE_KEY_PREFIX}doc-123`);
  });

  test('handles empty key', () => {
    expect(getStorageKey('')).toBe(STORAGE_KEY_PREFIX);
  });

  test('handles special characters in key', () => {
    expect(getStorageKey('doc/with/slashes')).toBe(`${STORAGE_KEY_PREFIX}doc/with/slashes`);
  });
});

// ============================================================================
// Schema Validation
// ============================================================================

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
    delete (data as Record<string, unknown>).id;
    expect(validateSessionSchema(data)).toBe(false);
  });

  test('returns false for missing status', () => {
    const data = { ...createValidPersistedSession() };
    delete (data as Record<string, unknown>).status;
    expect(validateSessionSchema(data)).toBe(false);
  });

  test('returns false for invalid status', () => {
    const data = createValidPersistedSession();
    (data as unknown as Record<string, unknown>).status = 'invalid';
    expect(validateSessionSchema(data)).toBe(false);
  });

  test('returns false for invalid outcome', () => {
    const data = createValidPersistedSession();
    (data as unknown as Record<string, unknown>).outcome = 'invalid';
    expect(validateSessionSchema(data)).toBe(false);
  });

  test('returns false for missing startedAt', () => {
    const data = { ...createValidPersistedSession() };
    delete (data as Record<string, unknown>).startedAt;
    expect(validateSessionSchema(data)).toBe(false);
  });

  test('returns false for missing updatedAt', () => {
    const data = { ...createValidPersistedSession() };
    delete (data as Record<string, unknown>).updatedAt;
    expect(validateSessionSchema(data)).toBe(false);
  });

  test('returns false for missing draftComments', () => {
    const data = { ...createValidPersistedSession() };
    delete (data as Record<string, unknown>).draftComments;
    expect(validateSessionSchema(data)).toBe(false);
  });

  test('returns false for non-array draftComments', () => {
    const data = createValidPersistedSession();
    (data as unknown as Record<string, unknown>).draftComments = 'not-array';
    expect(validateSessionSchema(data)).toBe(false);
  });

  test('returns false for non-string submittedAt', () => {
    const data = createValidPersistedSession();
    (data as unknown as Record<string, unknown>).submittedAt = 123;
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

// ============================================================================
// Save Session
// ============================================================================

describe('saveSession', () => {
  test('saves session to sessionStorage', () => {
    const session = createTestSession({ id: 'my-session' });
    const result = saveSession('doc-123', session);

    expect(result).toBe(true);
    expect(mockStorage.setItem).toHaveBeenCalledWith(
      `${STORAGE_KEY_PREFIX}doc-123`,
      expect.any(String),
    );
  });

  test('serializes session to JSON', () => {
    const session = createTestSession({ id: 'my-session' });
    saveSession('doc-123', session);

    const savedValue = (mockStorage.setItem as ReturnType<typeof mock>).mock.calls[0][1];
    const parsed = JSON.parse(savedValue);

    expect(parsed.id).toBe('my-session');
    expect(parsed.status).toBe('drafting');
  });

  test('strips runtime positions from anchors', () => {
    const session = createTestSession({
      draftComments: [
        {
          id: 'comment-1',
          anchor: createTestAnchor({ from: 100, to: 200 }),
          body: 'Test',
          authorId: 'user-1',
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
        },
      ],
    });
    saveSession('doc-123', session);

    const savedValue = (mockStorage.setItem as ReturnType<typeof mock>).mock.calls[0][1];
    const parsed = JSON.parse(savedValue);

    expect(parsed.draftComments[0].anchor.from).toBeUndefined();
    expect(parsed.draftComments[0].anchor.to).toBeUndefined();
  });

  test('handles storage errors gracefully', () => {
    (mockStorage.setItem as ReturnType<typeof mock>).mockImplementationOnce(() => {
      throw new Error('Storage full');
    });

    const session = createTestSession();
    const result = saveSession('doc-123', session);

    expect(result).toBe(false);
  });
});

// ============================================================================
// Load Session
// ============================================================================

describe('loadSession', () => {
  test('loads and restores session from sessionStorage', () => {
    const persisted = createValidPersistedSession({ id: 'restored-session' });
    (mockStorage.getItem as ReturnType<typeof mock>).mockReturnValueOnce(JSON.stringify(persisted));

    const result = loadSession('doc-123');

    expect(result).not.toBeNull();
    expect(result?.id).toBe('restored-session');
  });

  test('returns null when key does not exist', () => {
    (mockStorage.getItem as ReturnType<typeof mock>).mockReturnValueOnce(null);

    const result = loadSession('doc-123');

    expect(result).toBeNull();
  });

  test('returns null and clears corrupted data', () => {
    (mockStorage.getItem as ReturnType<typeof mock>).mockReturnValueOnce('not-json');

    const result = loadSession('doc-123');

    expect(result).toBeNull();
    expect(mockStorage.removeItem).toHaveBeenCalledWith(`${STORAGE_KEY_PREFIX}doc-123`);
  });

  test('returns null and clears invalid schema', () => {
    const invalid = { notValid: true };
    (mockStorage.getItem as ReturnType<typeof mock>).mockReturnValueOnce(JSON.stringify(invalid));

    const result = loadSession('doc-123');

    expect(result).toBeNull();
    expect(mockStorage.removeItem).toHaveBeenCalled();
  });

  test('returns null and clears submitted sessions', () => {
    const submitted = createValidPersistedSession({
      status: 'submitted',
      submittedAt: '2024-01-02T00:00:00.000Z',
    });
    (mockStorage.getItem as ReturnType<typeof mock>).mockReturnValueOnce(JSON.stringify(submitted));

    const result = loadSession('doc-123');

    expect(result).toBeNull();
    expect(mockStorage.removeItem).toHaveBeenCalled();
  });

  test('restores runtime anchor positions as placeholders', () => {
    const persisted = createValidPersistedSession({
      draftComments: [
        {
          id: 'comment-1',
          anchor: { quote: 'test', prefix: '', suffix: '', status: 'anchored' },
          body: 'Test',
          authorId: 'user-1',
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
        },
      ],
    });
    (mockStorage.getItem as ReturnType<typeof mock>).mockReturnValueOnce(JSON.stringify(persisted));

    const result = loadSession('doc-123');

    expect(result?.draftComments[0].anchor?.from).toBe(0);
    expect(result?.draftComments[0].anchor?.to).toBe(0);
  });

  test('handles storage read errors gracefully', () => {
    (mockStorage.getItem as ReturnType<typeof mock>).mockImplementationOnce(() => {
      throw new Error('Storage unavailable');
    });

    const result = loadSession('doc-123');

    expect(result).toBeNull();
  });
});

// ============================================================================
// Clear Session
// ============================================================================

describe('clearPersistedSession', () => {
  test('removes session from sessionStorage', () => {
    clearPersistedSession('doc-123');

    expect(mockStorage.removeItem).toHaveBeenCalledWith(`${STORAGE_KEY_PREFIX}doc-123`);
  });

  test('handles storage errors gracefully', () => {
    (mockStorage.removeItem as ReturnType<typeof mock>).mockImplementationOnce(() => {
      throw new Error('Storage unavailable');
    });

    // Should not throw
    expect(() => clearPersistedSession('doc-123')).not.toThrow();
  });
});

// ============================================================================
// Has Session
// ============================================================================

describe('hasPersistedSession', () => {
  test('returns true when session exists', () => {
    (mockStorage.getItem as ReturnType<typeof mock>).mockReturnValueOnce('{}');

    expect(hasPersistedSession('doc-123')).toBe(true);
  });

  test('returns false when session does not exist', () => {
    (mockStorage.getItem as ReturnType<typeof mock>).mockReturnValueOnce(null);

    expect(hasPersistedSession('doc-123')).toBe(false);
  });

  test('handles storage errors gracefully', () => {
    (mockStorage.getItem as ReturnType<typeof mock>).mockImplementationOnce(() => {
      throw new Error('Storage unavailable');
    });

    expect(hasPersistedSession('doc-123')).toBe(false);
  });
});

// ============================================================================
// List Sessions
// ============================================================================

describe('listPersistedSessions', () => {
  test('returns empty array when no sessions', () => {
    expect(listPersistedSessions()).toEqual([]);
  });

  test('returns document keys for matching sessions', () => {
    // Setup mock storage with some keys
    const mockKeys = [`${STORAGE_KEY_PREFIX}doc-1`, `${STORAGE_KEY_PREFIX}doc-2`, 'other-key'];
    mockStorage = createMockStorage({ keys: mockKeys });
    stubGlobal('sessionStorage', mockStorage);

    const result = listPersistedSessions();

    expect(result).toEqual(['doc-1', 'doc-2']);
  });

  test('filters out non-matching keys', () => {
    const mockKeys = ['other-key-1', 'other-key-2'];
    mockStorage = createMockStorage({ keys: mockKeys });
    stubGlobal('sessionStorage', mockStorage);

    expect(listPersistedSessions()).toEqual([]);
  });

  test('handles storage errors gracefully', () => {
    const throwingStorage = createMockStorage({ throwOnLength: true });
    stubGlobal('sessionStorage', throwingStorage);

    expect(listPersistedSessions()).toEqual([]);
  });
});

// ============================================================================
// Clear All Sessions
// ============================================================================

describe('clearAllPersistedSessions', () => {
  test('clears all review session keys', () => {
    const mockKeys = [`${STORAGE_KEY_PREFIX}doc-1`, `${STORAGE_KEY_PREFIX}doc-2`, 'other-key'];
    mockStorage = createMockStorage({ keys: mockKeys, removeItem: mock(() => {}) });
    stubGlobal('sessionStorage', mockStorage);

    clearAllPersistedSessions();

    expect(mockStorage.removeItem).toHaveBeenCalledTimes(2);
    expect(mockStorage.removeItem).toHaveBeenCalledWith(`${STORAGE_KEY_PREFIX}doc-1`);
    expect(mockStorage.removeItem).toHaveBeenCalledWith(`${STORAGE_KEY_PREFIX}doc-2`);
  });

  test('handles storage errors gracefully', () => {
    const throwingStorage = createMockStorage({ throwOnLength: true });
    stubGlobal('sessionStorage', throwingStorage);

    // Should not throw
    expect(() => clearAllPersistedSessions()).not.toThrow();
  });
});

// ============================================================================
// Round-trip Tests
// ============================================================================

describe('save/load round-trip', () => {
  test('preserves session data through save/load cycle', () => {
    const original = createTestSession({
      id: 'session-xyz',
      status: 'drafting',
      outcome: 'request_changes',
      draftComments: [
        {
          id: 'comment-1',
          anchor: createTestAnchor(),
          body: 'My comment',
          authorId: 'user-1',
          mentions: ['alice'],
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-02T00:00:00.000Z',
        },
      ],
      startedAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-02T00:00:00.000Z',
    });

    // Save
    saveSession('doc-123', original);

    // Get saved value and simulate load
    const savedValue = (mockStorage.setItem as ReturnType<typeof mock>).mock.calls[0][1];
    (mockStorage.getItem as ReturnType<typeof mock>).mockReturnValueOnce(savedValue);

    // Load
    const loaded = loadSession('doc-123');

    expect(loaded).not.toBeNull();
    expect(loaded!.id).toBe(original.id);
    expect(loaded!.status).toBe(original.status);
    expect(loaded!.outcome).toBe(original.outcome);
    expect(loaded!.draftComments).toHaveLength(1);
    expect(loaded!.draftComments[0].body).toBe('My comment');
    expect(loaded!.draftComments[0].mentions).toEqual(['alice']);
    expect(loaded!.startedAt).toBe(original.startedAt);
    expect(loaded!.updatedAt).toBe(original.updatedAt);
  });

  test('restores placeholder positions after round-trip', () => {
    const original = createTestSession({
      draftComments: [
        {
          id: 'comment-1',
          anchor: createTestAnchor({ from: 100, to: 200 }),
          body: 'Test',
          authorId: 'user-1',
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
        },
      ],
    });

    saveSession('doc-123', original);

    const savedValue = (mockStorage.setItem as ReturnType<typeof mock>).mock.calls[0][1];
    (mockStorage.getItem as ReturnType<typeof mock>).mockReturnValueOnce(savedValue);

    const loaded = loadSession('doc-123');

    // Positions are restored as placeholders (0, 0)
    expect(loaded!.draftComments[0].anchor?.from).toBe(0);
    expect(loaded!.draftComments[0].anchor?.to).toBe(0);
  });
});
