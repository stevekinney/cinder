import { afterEach, beforeEach, mock } from 'bun:test';
import type { CommentAnchor } from '../comments/types.js';
import type { PersistedReviewSession, ReviewSession } from './types.js';

type MockStorageOptions = {
  keys?: readonly string[];
  removeItem?: Storage['removeItem'];
  throwOnLength?: boolean;
};

export function createMockStorage(options: MockStorageOptions = {}) {
  let store: Record<string, string> = {};
  return {
    getItem: mock((key: string) => store[key] ?? null),
    setItem: mock((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: mock(
      options.removeItem ??
        ((key: string) => {
          delete store[key];
        }),
    ),
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

const originalWindow = globalThis.window;
const originalSessionStorage = globalThis.sessionStorage;

export function stubGlobal(name: 'window' | 'sessionStorage', value: unknown): void {
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

export function installStorageFixture() {
  const fixture = { storage: createMockStorage() };
  beforeEach(() => {
    fixture.storage = createMockStorage();
    stubGlobal('window', globalThis);
    stubGlobal('sessionStorage', fixture.storage);
  });
  afterEach(restoreGlobals);
  return fixture;
}

// ============================================================================
// Test Fixtures
// ============================================================================

export function createTestAnchor(overrides?: Partial<CommentAnchor>): CommentAnchor {
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

export function createTestSession(overrides?: Partial<ReviewSession>): ReviewSession {
  return {
    id: 'session-1',
    status: 'drafting',
    draftComments: [],
    startedAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    ...overrides,
  };
}

export function createValidPersistedSession(
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
