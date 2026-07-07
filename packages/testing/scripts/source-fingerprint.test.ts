import { describe, expect, test } from 'bun:test';
import { mkdirSync, mkdtempSync, rmSync, statSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  isFingerprintStale,
  newestFileMtimeMs,
  newestSourceMtimeMs,
} from './source-fingerprint.ts';

describe('newestFileMtimeMs', () => {
  test('returns null for a directory with no files', () => {
    const directory = mkdtempSync(join(tmpdir(), 'source-fingerprint-empty-'));
    try {
      expect(newestFileMtimeMs(directory)).toBeNull();
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  test('returns null for a directory that does not exist', () => {
    expect(newestFileMtimeMs(join(tmpdir(), 'does-not-exist-source-fingerprint'))).toBeNull();
  });

  test('finds the newest mtime across nested files', () => {
    const directory = mkdtempSync(join(tmpdir(), 'source-fingerprint-nested-'));
    try {
      writeFileSync(join(directory, 'a.txt'), 'a');
      const nestedDirectory = join(directory, 'nested');
      mkdirSync(nestedDirectory);
      writeFileSync(join(nestedDirectory, 'b.txt'), 'b');

      const newest = newestFileMtimeMs(directory);
      expect(newest).not.toBeNull();
      expect(typeof newest).toBe('number');
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  test('ignores dot-prefixed directories such as playground build scratch dirs', () => {
    const directory = mkdtempSync(join(tmpdir(), 'source-fingerprint-dotdir-'));
    try {
      const oldFile = join(directory, 'a.txt');
      writeFileSync(oldFile, 'a');

      const scratchDirectory = join(directory, '.tmp-abc123');
      mkdirSync(scratchDirectory);
      const scratchFile = join(scratchDirectory, 'entry.ts');
      writeFileSync(scratchFile, 'scratch');
      // Force the scratch file's mtime newer than the tracked file's so a
      // failure to skip it would be observable.
      const future = new Date(Date.now() + 60_000);
      utimesSync(scratchFile, future, future);

      const newest = newestFileMtimeMs(directory);
      const oldMtimeMs = statSync(oldFile).mtimeMs;
      expect(newest).toBe(oldMtimeMs);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});

describe('newestSourceMtimeMs', () => {
  test('returns null when none of the fingerprinted directories exist', () => {
    const emptyRoot = mkdtempSync(join(tmpdir(), 'source-fingerprint-root-'));
    try {
      expect(newestSourceMtimeMs(emptyRoot)).toBeNull();
    } finally {
      rmSync(emptyRoot, { recursive: true, force: true });
    }
  });

  test('resolves a real newest mtime against the actual repo root', () => {
    const repoRoot = join(import.meta.dirname, '../../..');
    expect(newestSourceMtimeMs(repoRoot)).not.toBeNull();
  });
});

describe('isFingerprintStale', () => {
  test('is not stale when the current source tree has no newer file', () => {
    expect(isFingerprintStale({ startedAtMs: 0, newestSourceMtimeMs: 100 }, 100)).toBe(false);
    expect(isFingerprintStale({ startedAtMs: 0, newestSourceMtimeMs: 100 }, 50)).toBe(false);
  });

  test('is stale when the current source tree has a file newer than the server saw at startup', () => {
    expect(isFingerprintStale({ startedAtMs: 0, newestSourceMtimeMs: 100 }, 200)).toBe(true);
  });

  test('treats an unknown current mtime as not stale (nothing to compare against)', () => {
    expect(isFingerprintStale({ startedAtMs: 0, newestSourceMtimeMs: 100 }, null)).toBe(false);
  });

  test('treats a server with no known startup mtime as stale when current source exists', () => {
    expect(isFingerprintStale({ startedAtMs: 0, newestSourceMtimeMs: null }, 100)).toBe(true);
  });
});
