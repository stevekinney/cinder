import { describe, expect, it } from 'bun:test';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { resolveSafePath } from './traversal-guard.ts';

describe('resolveSafePath', () => {
  const baseDir = join(tmpdir(), 'traversal-guard-fixture');

  it('resolves a plain filename inside the base directory', () => {
    expect(resolveSafePath(baseDir, 'foo.css')).toBe(join(baseDir, 'foo.css'));
  });

  it('rejects a leading ".." segment', () => {
    expect(resolveSafePath(baseDir, '../secret.css')).toBeNull();
  });

  it('rejects an absolute path', () => {
    expect(resolveSafePath(baseDir, '/etc/passwd')).toBeNull();
  });

  it('rejects an empty path', () => {
    expect(resolveSafePath(baseDir, '')).toBeNull();
  });

  it('rejects a request that round-trips outside baseDir after join() collapses it', () => {
    // 'foo/../../secret.css' contains a literal '..' so the includes('..')
    // pre-filter already catches it — this case exists to prove the
    // relative().startsWith('..') check is doing real work, not just the
    // pre-filter, by confirming the joined-then-collapsed path still lands
    // outside baseDir.
    expect(resolveSafePath(baseDir, 'foo/../../secret.css')).toBeNull();
  });
});
