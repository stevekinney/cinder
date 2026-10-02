import { requiredValue } from '@lostgradient/testing';
import { describe, expect, spyOn, test } from 'bun:test';
import { STORAGE_KEY_PREFIX, getStorageKey, loadSession, saveSession } from './persistence.js';

import {
  createTestAnchor,
  createTestSession,
  createValidPersistedSession,
  installStorageFixture,
} from './persistence-test-support.ts';
const fixture = installStorageFixture();

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

describe('saveSession', () => {
  test('saves session to sessionStorage', () => {
    const session = createTestSession({ id: 'my-session' });
    const result = saveSession('doc-123', session);

    expect(result).toBe(true);
    expect(fixture.storage.setItem).toHaveBeenCalledWith(
      `${STORAGE_KEY_PREFIX}doc-123`,
      expect.any(String),
    );
  });

  test('serializes session to JSON', () => {
    const session = createTestSession({ id: 'my-session' });
    saveSession('doc-123', session);

    const savedValue = requiredValue(fixture.storage.setItem.mock.calls[0])[1];
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

    const savedValue = requiredValue(fixture.storage.setItem.mock.calls[0])[1];
    const parsed = JSON.parse(savedValue);

    expect(requiredValue(parsed.draftComments[0]).anchor.from).toBeUndefined();
    expect(requiredValue(parsed.draftComments[0]).anchor.to).toBeUndefined();
  });

  test('handles storage errors gracefully', () => {
    const diagnostic = spyOn(console, 'warn').mockImplementation(() => {});
    try {
      fixture.storage.setItem.mockImplementationOnce(() => {
        throw new Error('Storage full');
      });

      const session = createTestSession();
      const result = saveSession('doc-123', session);

      expect(result).toBe(false);

      expect(diagnostic).toHaveBeenCalledTimes(1);
      expect(diagnostic).toHaveBeenCalledWith(
        'Failed to persist review session:',
        new Error('Storage full'),
      );
    } finally {
      diagnostic.mockRestore();
    }
  });
});

describe('loadSession', () => {
  test('loads and restores session from sessionStorage', () => {
    const persisted = createValidPersistedSession({ id: 'restored-session' });
    fixture.storage.getItem.mockReturnValueOnce(JSON.stringify(persisted));

    const result = loadSession('doc-123');

    expect(result).not.toBeNull();
    expect(result?.id).toBe('restored-session');
  });

  test('returns null when key does not exist', () => {
    fixture.storage.getItem.mockReturnValueOnce(null);

    const result = loadSession('doc-123');

    expect(result).toBeNull();
  });

  test('returns null and clears corrupted data', () => {
    const diagnostic = spyOn(console, 'warn').mockImplementation(() => {});
    try {
      fixture.storage.getItem.mockReturnValueOnce('not-json');

      const result = loadSession('doc-123');

      expect(result).toBeNull();
      expect(fixture.storage.removeItem).toHaveBeenCalledWith(`${STORAGE_KEY_PREFIX}doc-123`);

      expect(diagnostic).toHaveBeenCalledTimes(1);
      expect(diagnostic).toHaveBeenCalledWith(
        'Failed to load review session:',
        expect.any(SyntaxError),
      );
    } finally {
      diagnostic.mockRestore();
    }
  });

  test('keeps load diagnostics in a production browser bundle', async () => {
    const bundle = await Bun.build({
      entrypoints: [new URL('./persistence.ts', import.meta.url).pathname],
      target: 'browser',
      conditions: ['production'],
      define: { 'process.env.NODE_ENV': '"production"' },
      minify: true,
    });
    expect(bundle.success, JSON.stringify(bundle.logs)).toBe(true);
    const output = requiredValue(bundle.outputs[0]);
    const moduleUrl = `data:text/javascript;base64,${Buffer.from(await output.text()).toString('base64')}`;
    const child = Bun.spawn(
      [
        process.execPath,
        '--eval',
        `process.stdin.setEncoding('utf8');
let moduleUrl = '';
for await (const chunk of process.stdin) moduleUrl += chunk;
globalThis.window = globalThis;
globalThis.sessionStorage = {
  getItem: () => 'not-json',
  removeItem: () => {},
};
const warnings = [];
console.warn = (...args) => warnings.push({
  message: args[0],
  syntaxError: args[1] instanceof SyntaxError,
});
const { loadSession } = await import(moduleUrl);
const result = loadSession('doc-123');
process.stdout.write(JSON.stringify({ result, warnings }));`,
      ],
      {
        stdin: new TextEncoder().encode(moduleUrl),
        stdout: 'pipe',
        stderr: 'pipe',
      },
    );
    const [status, stdout, stderr] = await Promise.all([
      child.exited,
      new Response(child.stdout).text(),
      new Response(child.stderr).text(),
    ]);
    expect(status, stderr).toBe(0);
    expect(stderr).toBe('');
    const observation: unknown = JSON.parse(stdout);
    expect(observation).toEqual({
      result: null,
      warnings: [{ message: 'Failed to load review session:', syntaxError: true }],
    });
  });

  test('returns null and clears invalid schema', () => {
    const diagnostic = spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const invalid = { notValid: true };
      fixture.storage.getItem.mockReturnValueOnce(JSON.stringify(invalid));

      const result = loadSession('doc-123');

      expect(result).toBeNull();
      expect(fixture.storage.removeItem).toHaveBeenCalled();

      expect(diagnostic).toHaveBeenCalledTimes(1);
      expect(diagnostic).toHaveBeenCalledWith(
        'Review session schema validation failed, clearing corrupted data',
      );
    } finally {
      diagnostic.mockRestore();
    }
  });

  test('returns null and clears submitted sessions', () => {
    const diagnostic = spyOn(console, 'info').mockImplementation(() => {});
    try {
      const submitted = createValidPersistedSession({
        status: 'submitted',
        submittedAt: '2024-01-02T00:00:00.000Z',
      });
      fixture.storage.getItem.mockReturnValueOnce(JSON.stringify(submitted));

      const result = loadSession('doc-123');

      expect(result).toBeNull();
      expect(fixture.storage.removeItem).toHaveBeenCalled();

      expect(diagnostic).toHaveBeenCalledTimes(1);
      expect(diagnostic).toHaveBeenCalledWith('Clearing stale submitted review session');
    } finally {
      diagnostic.mockRestore();
    }
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
    fixture.storage.getItem.mockReturnValueOnce(JSON.stringify(persisted));

    const result = loadSession('doc-123');

    expect(requiredValue(result?.draftComments[0]).anchor?.from).toBe(0);
    expect(requiredValue(result?.draftComments[0]).anchor?.to).toBe(0);
  });

  test('handles storage read errors gracefully', () => {
    const diagnostic = spyOn(console, 'warn').mockImplementation(() => {});
    try {
      fixture.storage.getItem.mockImplementationOnce(() => {
        throw new Error('Storage unavailable');
      });

      const result = loadSession('doc-123');

      expect(result).toBeNull();

      expect(diagnostic).toHaveBeenCalledTimes(1);
      expect(diagnostic).toHaveBeenCalledWith(
        'Failed to load review session:',
        new Error('Storage unavailable'),
      );
    } finally {
      diagnostic.mockRestore();
    }
  });
});

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
    const savedValue = requiredValue(fixture.storage.setItem.mock.calls[0])[1];
    fixture.storage.getItem.mockReturnValueOnce(savedValue);

    // Load
    const loaded = loadSession('doc-123');

    expect(loaded).not.toBeNull();
    expect(requiredValue(loaded).id).toBe(original.id);
    expect(requiredValue(loaded).status).toBe(original.status);
    expect(requiredValue(loaded).outcome).toBe(original.outcome);
    expect(requiredValue(loaded).draftComments).toHaveLength(1);
    expect(requiredValue(requiredValue(loaded).draftComments[0]).body).toBe('My comment');
    expect(requiredValue(requiredValue(loaded).draftComments[0]).mentions).toEqual(['alice']);
    expect(requiredValue(loaded).startedAt).toBe(original.startedAt);
    expect(requiredValue(loaded).updatedAt).toBe(original.updatedAt);
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

    const savedValue = requiredValue(fixture.storage.setItem.mock.calls[0])[1];
    fixture.storage.getItem.mockReturnValueOnce(savedValue);

    const loaded = loadSession('doc-123');

    // Positions are restored as placeholders (0, 0)
    expect(requiredValue(requiredValue(loaded).draftComments[0]).anchor?.from).toBe(0);
    expect(requiredValue(requiredValue(loaded).draftComments[0]).anchor?.to).toBe(0);
  });
});
