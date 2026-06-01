import { describe, expect, it } from 'bun:test';

import { parseEnvSlugs, testPathsForScope } from './test-changed.ts';

describe('parseEnvSlugs', () => {
  it('returns an empty list when unset', () => {
    expect(parseEnvSlugs(undefined)).toEqual([]);
  });

  it('returns an empty list for an empty/whitespace value', () => {
    expect(parseEnvSlugs('')).toEqual([]);
    expect(parseEnvSlugs('   ')).toEqual([]);
  });

  it('parses, trims, and drops empties', () => {
    expect(parseEnvSlugs('button, badge ,, dialog')).toEqual(['button', 'badge', 'dialog']);
  });
});

describe('testPathsForScope', () => {
  it('returns null (full suite) for a full decision', () => {
    expect(testPathsForScope({ mode: 'full', reason: 'lockfile change' })).toBeNull();
  });

  it('returns null (full suite) when filtered but empty', () => {
    expect(testPathsForScope({ mode: 'filtered', slugs: [] })).toBeNull();
  });

  it('maps slugs to component dirs plus the always-run shared dirs and root tests', () => {
    const paths = testPathsForScope({ mode: 'filtered', slugs: ['button', 'badge'] });
    // Shared-source dirs whose own tests must run when a shared change widens slugs.
    expect(paths).toContain('src/test');
    expect(paths).toContain('src/utilities');
    expect(paths).toContain('src/_internal');
    expect(paths).toContain('src/highlighters');
    // Package-level invariant tests (export drift, manifest, conventions).
    expect(paths).toContain('src/exports-drift.test.ts');
    expect(paths).toContain('src/api-contract.test.ts');
    expect(paths).toContain('src/manifest.test.ts');
    // The scoped component dirs.
    expect(paths).toContain('src/components/button');
    expect(paths).toContain('src/components/badge');
  });

  it('always includes shared dirs + root invariant tests but NOT scripts/', () => {
    const paths = testPathsForScope({ mode: 'filtered', slugs: ['accordion'] });
    expect(paths).toContain('src/test');
    expect(paths).toContain('src/utilities');
    expect(paths).toContain('src/exports-drift.test.ts');
    // scripts/ tooling tests run only when scripts/ changes (which force-fulls).
    expect(paths).not.toContain('scripts');
    expect(paths).toContain('src/components/accordion');
  });
});
