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

  it('accepts a filename that merely contains ".." as a substring', () => {
    // 'foo..css' has no '..' path *segment* — the whole thing is one
    // filename. A naive `requestedPath.includes('..')` check rejects it
    // anyway, even though it can't escape baseDir.
    expect(resolveSafePath(baseDir, 'foo..css')).toBe(join(baseDir, 'foo..css'));
  });

  it('rejects an absolute path', () => {
    expect(resolveSafePath(baseDir, '/etc/passwd')).toBeNull();
  });

  it('rejects an empty path', () => {
    expect(resolveSafePath(baseDir, '')).toBeNull();
  });

  it('rejects nested ".." segments, not just a single leading one', () => {
    // Every segment is checked, not just the first, so a '..' buried in the
    // middle of the path is caught too. This is a regression guard for the
    // per-segment filter itself — the join()+relative() check below it
    // exists as defense-in-depth against a future regression in that
    // filter, but on POSIX join() can't produce a path outside baseDir once
    // every '..' segment is already rejected here, so this input (like any
    // input the segment filter correctly rejects) never reaches that second
    // check.
    expect(resolveSafePath(baseDir, 'foo/../../secret.css')).toBeNull();
  });

  it('rejects a backslash-disguised ".." segment', () => {
    // node:path.join() is platform-specific: on POSIX '\' is just an
    // ordinary filename character, but on win32 it's a path separator. A
    // '/'-only segment splitter sees 'foo/..\..\secret.css' as two
    // harmless-looking segments ('foo' and a filename that merely
    // *contains* backslashes) and lets it through — but win32's join()
    // would walk 'foo' -> '..' (back to baseDir) -> '..' (above baseDir),
    // landing outside baseDir. Reject backslash-containing segments
    // regardless of host OS, not just when the host happens to be POSIX.
    expect(resolveSafePath(baseDir, 'foo/..\\..\\secret.css')).toBeNull();
  });
});

it('rejects a path containing a NUL byte instead of passing it to the filesystem', () => {
  const nulPath = 'tokens' + String.fromCharCode(0) + '.css';
  expect(resolveSafePath('/tmp', nulPath)).toBeNull();
});
