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

  it('maps slugs to component directories plus the always-run shared test dir', () => {
    const paths = testPathsForScope({ mode: 'filtered', slugs: ['button', 'badge'] });
    expect(paths).toEqual(['src/test', 'src/components/button', 'src/components/badge']);
  });

  it('always includes the shared test infra dir but NOT scripts/', () => {
    const paths = testPathsForScope({ mode: 'filtered', slugs: ['accordion'] });
    expect(paths).toContain('src/test');
    // scripts/ tooling tests run only when scripts/ changes (which force-fulls).
    expect(paths).not.toContain('scripts');
    expect(paths).toContain('src/components/accordion');
  });
});
