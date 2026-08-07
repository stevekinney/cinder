import { describe, expect, test } from 'bun:test';
import postcss from 'postcss';

import {
  compoundFamilies,
  declarationMultiset,
  findDuplicatePairs,
  MINIMUM_DECLARATIONS,
  multisetSimilarity,
  multisetSize,
  pairKey,
  readBaseline,
  siblingLeafImports,
  SIMILARITY_THRESHOLD,
} from './check-css-duplication.ts';

function multisetFor(css: string, componentName: string) {
  return declarationMultiset(postcss.parse(css), componentName);
}

const PANEL_CSS = `
@layer cinder.components {
  .cinder-x { border: none; background: transparent; padding: 0; margin: 0; position: fixed; inset: 0; width: 100vw; height: 100dvh; }
  .cinder-x__panel { background: var(--cinder-surface-raised); box-shadow: var(--cinder-shadow-lg); display: flex; flex-direction: column; overflow: hidden; opacity: 1; }
}`;

describe('declarationMultiset', () => {
  test('drops selectors and keeps at-rule context (but not the layer wrapper)', () => {
    const multiset = multisetFor(
      `@layer cinder.components { .cinder-x { color: red; } @media (hover: hover) { .cinder-x:hover { color: red; } } }`,
      'x',
    );
    expect(multiset.get('|color:red')).toBe(1);
    expect(multiset.get('@media (hover: hover)|color:red')).toBe(1);
  });

  test('collapses private and component-scoped custom properties to a placeholder', () => {
    const drawer = multisetFor(
      `.a { box-shadow: inset 0 0 0 1px var(--_cinder-drawer-close-ring, var(--cinder-ring-color)); }`,
      'drawer',
    );
    const sheet = multisetFor(
      `.b { box-shadow: inset 0 0 0 1px var(--_cinder-sheet-close-ring, var(--cinder-ring-color)); }`,
      'sheet',
    );
    expect([...drawer.keys()]).toEqual([...sheet.keys()]);
  });

  test('keeps shared public tokens verbatim — token reuse is not duplication evidence', () => {
    const multiset = multisetFor(`.a { gap: var(--cinder-space-2); }`, 'a');
    expect(multiset.get('|gap:var(--cinder-space-2)')).toBe(1);
  });
});

describe('multisetSimilarity', () => {
  test('identical stylesheets score 1', () => {
    const a = multisetFor(PANEL_CSS, 'x');
    expect(multisetSimilarity(a, a)).toBe(1);
    expect(multisetSize(a)).toBeGreaterThanOrEqual(MINIMUM_DECLARATIONS);
  });

  test('disjoint stylesheets score 0', () => {
    const a = multisetFor(`.a { color: red; }`, 'a');
    const b = multisetFor(`.b { display: flex; }`, 'b');
    expect(multisetSimilarity(a, b)).toBe(0);
  });
});

describe('findDuplicatePairs', () => {
  const nearDuplicate = (name: string) => ({
    name,
    multiset: multisetFor(PANEL_CSS, name),
    familyRoot: name,
  });

  test('flags an unbaselined near-duplicate pair', () => {
    const violations = findDuplicatePairs([nearDuplicate('alpha'), nearDuplicate('beta')], []);
    expect(violations).toHaveLength(1);
    expect(violations[0]?.a).toBe('alpha');
    expect(violations[0]?.b).toBe('beta');
    expect(violations[0]?.similarity).toBeGreaterThanOrEqual(SIMILARITY_THRESHOLD);
    expect(violations[0]?.message).toContain('component-admission-bar');
  });

  test('a baselined pair is not flagged', () => {
    const violations = findDuplicatePairs(
      [nearDuplicate('alpha'), nearDuplicate('beta')],
      [{ a: 'alpha', b: 'beta', reason: 'test fixture' }],
    );
    expect(violations).toEqual([]);
  });

  test('intra-compound-family pairs are exempt', () => {
    const violations = findDuplicatePairs(
      [
        { ...nearDuplicate('parent'), familyRoot: 'family' },
        { ...nearDuplicate('leaf'), familyRoot: 'family' },
      ],
      [],
    );
    expect(violations).toEqual([]);
  });

  test('tiny sidecars below the declaration floor never pair', () => {
    const tiny = (name: string) => ({
      name,
      multiset: multisetFor(`.x { color: red; }`, name),
      familyRoot: name,
    });
    expect(findDuplicatePairs([tiny('a'), tiny('b')], [])).toEqual([]);
  });
});

describe('compound-family plumbing', () => {
  test('sibling-leaf imports parse and union transitively', () => {
    expect(
      siblingLeafImports(`@import '../tab/tab.css';\n@import '../tab-list/tab-list.css';`),
    ).toEqual(['tab', 'tab-list']);
    const families = compoundFamilies([
      ['tabs', 'tab'],
      ['tab', 'tab-list'],
    ]);
    expect(families.get('tabs')).toBe(families.get('tab-list'));
  });

  test('pairKey sorts lexicographically', () => {
    expect(pairKey('b', 'a')).toEqual(['a', 'b']);
  });
});

describe('baseline hygiene', () => {
  test('every baseline entry is sorted, deduplicated, and carries a real reason', () => {
    const baseline = readBaseline();
    const seen = new Set<string>();
    for (const entry of baseline) {
      expect(entry.a < entry.b).toBe(true);
      expect(entry.reason.trim().length).toBeGreaterThan(0);
      expect(entry.reason).not.toContain('TODO');
      const key = `${entry.a} ${entry.b}`;
      expect(seen.has(key)).toBe(false);
      seen.add(key);
    }
  });
});
