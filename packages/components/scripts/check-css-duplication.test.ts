import { describe, expect, test } from 'bun:test';
import { parse } from 'postcss';

import {
  componentClassNamesForComponent,
  componentClassNamesFromMarkup,
  componentClassNamesFromStylesheet,
  compoundFamilies,
  declarationMultiset,
  declarationMultisetForComponent,
  findDuplicatePairs,
  MINIMUM_DECLARATIONS,
  multisetSimilarity,
  multisetSize,
  pairKey,
  placeholderBaselineEntries,
  readBaseline,
  siblingLeafImports,
  SIMILARITY_THRESHOLD,
} from './check-css-duplication.ts';

function multisetFor(css: string, componentName: string) {
  return declarationMultiset(parse(css), componentName);
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

  test('attributes child rules in a parent stylesheet to the child component', () => {
    const parentStylesheet = parse(`
      .cinder-grid { display: grid; gap: 1rem; }
      .cinder-grid-item { grid-column-start: auto; grid-column-end: span 1; grid-row-start: auto; padding: 1rem; margin: 0; border: 0; background: transparent; min-width: 0; min-height: 0; position: relative; outline: 0; box-sizing: border-box; }
    `);
    const bentoCell = parse(`
      .cinder-bento-cell { grid-column-start: auto; grid-column-end: span 1; grid-row-start: auto; padding: 1rem; margin: 0; border: 0; background: transparent; min-width: 0; min-height: 0; position: relative; outline: 0; box-sizing: border-box; }
    `);
    const gridItem = {
      name: 'grid-item',
      multiset: declarationMultisetForComponent(parentStylesheet, 'grid-item'),
      familyRoot: 'grid',
    };
    const duplicate = {
      name: 'bento-cell',
      multiset: declarationMultisetForComponent(bentoCell, 'bento-cell'),
      familyRoot: 'bento-cell',
    };

    expect(multisetSize(gridItem.multiset)).toBeGreaterThanOrEqual(MINIMUM_DECLARATIONS);
    expect(findDuplicatePairs([gridItem, duplicate], [])).toHaveLength(1);
  });

  test('attributes BEM modifier rules without absorbing unrelated selectors', () => {
    const stylesheet = parse(`
      .cinder-grid-item--active { color: red; }
      .cinder-grid-item__label { font-weight: 600; }
      .cinder-grid { display: grid; }
    `);
    const multiset = declarationMultisetForComponent(stylesheet, 'grid-item');

    expect([...multiset.keys()]).toEqual(['|color:red', '|font-weight:600']);
  });

  test('attributes descendant rules to their rightmost component target', () => {
    const stylesheet = parse(`
      .cinder-tab-list .cinder-tab[data-cinder-active]::after { height: 2px; }
    `);

    expect(multisetSize(declarationMultisetForComponent(stylesheet, 'tab-list'))).toBe(0);
    expect([...declarationMultisetForComponent(stylesheet, 'tab').keys()]).toEqual(['|height:2px']);
  });

  test('discovers compound-leaf selectors from rendered markup', () => {
    expect(
      componentClassNamesFromMarkup(
        `<tr class="cinder-table__row"><td class:cinder-table__row--selected={selected}></td></tr>`,
      ),
    ).toEqual(['cinder-table__row', 'cinder-table__row--selected']);
  });

  test('does not claim sibling primitive classes rendered by a compound leaf', () => {
    expect(
      componentClassNamesForComponent(
        `<tr class="cinder-table__row"><td class="cinder-table__header-cell cinder-table__cell"></td></tr>`,
        'table-row',
        ['table'],
      ),
    ).toEqual(['cinder-table__row']);
  });

  test('keeps a shared compound leaf root while ignoring parent script queries', () => {
    expect(
      componentClassNamesForComponent(
        `<script>panel.querySelectorAll('.cinder-speed-dial-action');</script><button class="cinder-speed-dial-action"></button>`,
        'speed-dial-action',
        ['speed-dial'],
      ),
    ).toEqual(['cinder-speed-dial-action']);
  });

  test('keeps a BEM compound leaf root rendered by its parent and other composites', () => {
    expect(
      componentClassNamesForComponent(
        `<td class="cinder-table__cell cinder-table__cell--selection"></td>`,
        'table-cell',
        ['table'],
      ),
    ).toEqual(['cinder-table__cell', 'cinder-table__cell--selection']);
  });

  test('discovers compound-leaf selectors from sidecar CSS', () => {
    expect(
      componentClassNamesFromStylesheet(
        parse('.cinder-table__row--selected { color: var(--cinder-accent); }'),
      ),
    ).toEqual(['cinder-table__row--selected']);
  });

  test('keeps keyframe declarations in their owning component stylesheet', () => {
    const stylesheet = parse(`
      @keyframes cinder-jse-pulse { from { opacity: 0; } to { opacity: 1; } }
      .cinder-jse { animation: cinder-jse-pulse 1s; }
    `);
    const multiset = declarationMultisetForComponent(stylesheet, 'json-schema-editor', () => true);

    expect(multisetSize(multiset)).toBe(3);
    expect([...multiset.keys()]).toContain('@keyframes cinder-jse-pulse|opacity:0');
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
      siblingLeafImports(
        `import Tab from '../tab/tab.svelte';\nimport TabList from '../tab-list/tab-list.svelte';`,
      ),
    ).toEqual(['tab', 'tab-list']);
    const families = compoundFamilies([
      ['tabs', 'tab'],
      ['tab', 'tab-list'],
    ]);
    expect(families.get('tabs')).toBe(families.get('tab-list'));
  });

  test('CSS dependency imports are NOT compound-family edges', () => {
    // Composed standalone components import many siblings' CSS as
    // dependencies — those must not merge families and exempt the pair.
    expect(siblingLeafImports(`@import '../badge/badge.css';`)).toEqual([]);
    // Nor do ordinary named/type imports from a sibling's non-root modules.
    expect(
      siblingLeafImports(`import type { BadgeProps } from '../badge/badge.types.ts';`),
    ).toEqual([]);
  });

  test('blank and TODO placeholder baseline reasons are rejected', () => {
    expect(
      placeholderBaselineEntries([
        { a: 'x', b: 'y', reason: '' },
        { a: 'x', b: 'z', reason: '   ' },
        { a: 'y', b: 'z', reason: 'TODO: justify why this similarity is legitimate.' },
        { a: 'a', b: 'b', reason: 'Shared chart chrome, distinct mark behaviors.' },
      ]).map((entry) => [entry.a, entry.b]),
    ).toEqual([
      ['x', 'y'],
      ['x', 'z'],
      ['y', 'z'],
    ]);
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
