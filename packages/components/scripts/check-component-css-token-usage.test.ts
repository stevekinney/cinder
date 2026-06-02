import { describe, expect, test } from 'bun:test';

import {
  buildBaselineEntries,
  classifyReference,
  componentDirKey,
  componentOwnedPrefix,
  countByKey,
  findDeclaredNames,
  findReferences,
  findRegressions,
  flagKey,
  isTestPath,
  matchesPrefix,
  parseBaseline,
  parseGlobalTokens,
  toPosixPath,
} from './check-component-css-token-usage.ts';

describe('parseGlobalTokens', () => {
  test('collects LHS custom-property declarations', () => {
    const css = ':root {\n  --cinder-space-4: 1rem;\n  --cinder-radius-md: 0.5rem;\n}';
    const tokens = parseGlobalTokens(css);
    expect(tokens.has('--cinder-space-4')).toBe(true);
    expect(tokens.has('--cinder-radius-md')).toBe(true);
  });

  test('does not collect a var() reference as a declaration', () => {
    const tokens = parseGlobalTokens('.x { color: var(--cinder-accent); }');
    expect(tokens.has('--cinder-accent')).toBe(false);
  });
});

describe('findReferences — var() reference extraction', () => {
  test('captures a simple reference with its line number', () => {
    const refs = findReferences('a\n.x { color: var(--cinder-accent); }');
    expect(refs).toEqual([{ name: '--cinder-accent', lineNumber: 2 }]);
  });

  test('captures BOTH names in a nested var() fallback', () => {
    const refs = findReferences(
      '.x { background: var(--cinder-toggle-track-off, var(--cinder-border-muted)); }',
    );
    expect(refs.map((r) => r.name)).toEqual(['--cinder-toggle-track-off', '--cinder-border-muted']);
  });

  test('captures private --_cinder references too (so they can be classified)', () => {
    const refs = findReferences('.x { color: var(--_cinder-internal); }');
    expect(refs.map((r) => r.name)).toEqual(['--_cinder-internal']);
  });

  test('ignores a non-cinder var()', () => {
    expect(findReferences('.x { color: var(--other-thing); }')).toEqual([]);
  });
});

describe('findDeclaredNames — what a component owns', () => {
  test('collects a CSS LHS declaration', () => {
    expect(
      findDeclaredNames('.x { --cinder-kanban-column-width: 18rem; }').has(
        '--cinder-kanban-column-width',
      ),
    ).toBe(true);
  });

  test('collects a JS setProperty name', () => {
    const declared = findDeclaredNames(
      "shell.style.setProperty('--cinder-toast-height', `${h}px`);",
    );
    expect(declared.has('--cinder-toast-height')).toBe(true);
  });

  test('does NOT collect a plain var() reference as declared', () => {
    expect(findDeclaredNames('.x { color: var(--cinder-accent); }').has('--cinder-accent')).toBe(
      false,
    );
  });
});

describe('componentOwnedPrefix / componentDirKey', () => {
  test('derives the prefix from the component directory', () => {
    expect(componentOwnedPrefix('src/components/color-picker/color-picker.css')).toBe(
      '--cinder-color-picker',
    );
    expect(componentDirKey('src/components/color-picker/color-picker.css')).toBe('color-picker');
  });

  test('returns null for a bare file with no component directory', () => {
    expect(componentOwnedPrefix('src/components/_sortable-item.svelte')).toBeNull();
    expect(componentDirKey('src/components/_sortable-item.svelte')).toBeNull();
  });
});

describe('matchesPrefix — hyphen-boundary safety', () => {
  test('matches exact and hyphen-extended names', () => {
    expect(matchesPrefix('--cinder-toast', '--cinder-toast')).toBe(true);
    expect(matchesPrefix('--cinder-toast-height', '--cinder-toast')).toBe(true);
  });

  test('does NOT match a different token that merely shares a leading substring', () => {
    // `--cinder-toast` must not own `--cinder-toaster-*` or `--cinder-toastx`.
    expect(matchesPrefix('--cinder-toaster-x', '--cinder-toast')).toBe(false);
    expect(matchesPrefix('--cinder-toastx', '--cinder-toast')).toBe(false);
  });
});

describe('classifyReference — the resolution model', () => {
  const globals = new Set(['--cinder-accent', '--cinder-space-4']);

  test('private --_cinder-* is private', () => {
    expect(classifyReference('--_cinder-x', [], new Set(), globals)).toBe('private');
  });

  test('a declared global token is global', () => {
    expect(classifyReference('--cinder-accent', [], new Set(), globals)).toBe('global');
  });

  test('a reference matching the file prefix is component-owned', () => {
    expect(
      classifyReference('--cinder-color-picker-hue', ['--cinder-color-picker'], new Set(), globals),
    ).toBe('component-owned');
  });

  test('a SHORTENED-prefix own var resolves via the declared set, not the dir prefix', () => {
    // toast-region/ dir → prefix --cinder-toast-region, but the var is --cinder-toast-height.
    // The prefix does NOT match; the declared set (collected from setProperty) does.
    expect(
      classifyReference('--cinder-toast-height', ['--cinder-toast-region'], new Set(), globals),
    ).toBe('unresolved');
    expect(
      classifyReference(
        '--cinder-toast-height',
        ['--cinder-toast-region'],
        new Set(['--cinder-toast-height']),
        globals,
      ),
    ).toBe('component-owned');
  });

  test('the surface/ collision: --cinder-surface-muted from a non-surface file is unresolved', () => {
    // feed.css owns --cinder-feed, NOT --cinder-surface. Even though a `surface/`
    // component dir exists, per-file-prefix means feed does not own surface-*.
    expect(classifyReference('--cinder-surface-muted', ['--cinder-feed'], new Set(), globals)).toBe(
      'unresolved',
    );
  });

  test('an unknown token is unresolved', () => {
    expect(classifyReference('--cinder-totally-fake', ['--cinder-x'], new Set(), globals)).toBe(
      'unresolved',
    );
  });
});

describe('toPosixPath / isTestPath', () => {
  test('toPosixPath converts backslashes', () => {
    expect(toPosixPath('a\\b')).toBe('a/b');
  });

  test('isTestPath matches test/spec/examples, not real sources', () => {
    expect(isTestPath('x/x.test.ts')).toBe(true);
    expect(isTestPath('x/x.examples.json')).toBe(true);
    expect(isTestPath('x/x.css')).toBe(false);
  });
});

describe('count-based baseline + regression detection (unresolved only)', () => {
  const flags = [
    { filePath: 'src/components/a/a.css', name: '--cinder-stale-one' },
    { filePath: 'src/components/a/a.css', name: '--cinder-stale-one' },
    { filePath: 'src/components/b/b.css', name: '--cinder-stale-two' },
  ];

  test('countByKey aggregates by file + name', () => {
    expect(
      countByKey(flags).get(
        flagKey({ filePath: 'src/components/a/a.css', name: '--cinder-stale-one' }),
      ),
    ).toBe(2);
  });

  test('buildBaselineEntries dedupes to one entry per key with the count', () => {
    const entries = buildBaselineEntries(flags);
    expect(entries).toHaveLength(2);
    expect(entries.find((e) => e.name === '--cinder-stale-one')?.allowedCount).toBe(2);
  });

  test('findRegressions flags a count above baseline (not vacuous)', () => {
    const baseline = parseBaseline(buildBaselineEntries(flags));
    const withExtra = [
      ...flags,
      { filePath: 'src/components/a/a.css', name: '--cinder-stale-one' },
    ];
    const regressions = findRegressions(withExtra, baseline);
    expect(regressions).toHaveLength(1);
    expect(regressions[0]).toMatchObject({ name: '--cinder-stale-one', allowed: 2, found: 3 });
  });

  test('findRegressions splits the key correctly even when the name contains no extra ::', () => {
    const baseline = parseBaseline([]);
    const regressions = findRegressions(
      [{ filePath: 'src/components/c/c.css', name: '--cinder-new' }],
      baseline,
    );
    expect(regressions[0]).toMatchObject({
      filePath: 'src/components/c/c.css',
      name: '--cinder-new',
      allowed: 0,
      found: 1,
    });
  });

  test('equal-to-baseline counts do not regress', () => {
    const baseline = parseBaseline(buildBaselineEntries(flags));
    expect(findRegressions(flags, baseline)).toEqual([]);
  });

  test('parseBaseline throws on malformed input', () => {
    expect(() => parseBaseline({})).toThrow();
    expect(() => parseBaseline([{ filePath: 'x' }])).toThrow();
  });
});
