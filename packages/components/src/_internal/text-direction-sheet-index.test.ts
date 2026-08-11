/// <reference lib="dom" />
import { afterEach, describe, expect, test } from 'bun:test';

import { setupHappyDom } from '../test/happy-dom.ts';
import { matchesDirectionStyleRule } from './text-direction-css.ts';
import {
  resetDirectionStyleSheetIndex,
  styleSheetDeclaresDirection,
} from './text-direction-sheet-index.ts';

setupHappyDom();

afterEach(() => {
  document.body.replaceChildren();
  resetDirectionStyleSheetIndex();
});

function styleRule(selectorText: string, direction = '', nested?: unknown): CSSRule {
  const rule = { cssText: selectorText, type: 1, selectorText, style: { direction } };
  if (nested !== undefined) {
    Object.defineProperty(rule, 'cssRules', { configurable: true, get: () => nested });
  }
  return rule as unknown as CSSRule;
}

function groupRule(nested: unknown, counter?: { reads: number }): CSSRule {
  const rule = { cssText: '@media all {}', type: 4, conditionText: 'all', media: {} };
  Object.defineProperty(rule, 'cssRules', {
    configurable: true,
    get: () => {
      if (counter) counter.reads++;
      return nested;
    },
  });
  return rule as unknown as CSSRule;
}

function importRule(imported: unknown): CSSRule {
  return {
    cssText: '@import url(x.css);',
    type: 3,
    styleSheet: imported,
  } as unknown as CSSRule;
}

/** A stylesheet whose top-level `cssRules` reads are counted. */
function sheet(rules: CSSRule[], counter?: { reads: number }): CSSStyleSheet {
  const object = {};
  Object.defineProperty(object, 'cssRules', {
    configurable: true,
    get: () => {
      if (counter) counter.reads++;
      return rules;
    },
  });
  return object as CSSStyleSheet;
}

describe('styleSheetDeclaresDirection', () => {
  test('is false for a sheet that never declares direction', () => {
    expect(
      styleSheetDeclaresDirection(sheet([styleRule('.a'), styleRule('.b'), groupRule([])])),
    ).toBe(false);
  });

  test('is true for a top-level declaration', () => {
    expect(styleSheetDeclaresDirection(sheet([styleRule('.a'), styleRule('.b', 'rtl')]))).toBe(
      true,
    );
  });

  test('finds a declaration nested inside a conditional rule', () => {
    expect(styleSheetDeclaresDirection(sheet([groupRule([styleRule('.deep', 'ltr')])]))).toBe(true);
  });

  test('finds a declaration nested inside a style rule (native nesting)', () => {
    expect(
      styleSheetDeclaresDirection(sheet([styleRule('.outer', '', [styleRule('& .inner', 'rtl')])])),
    ).toBe(true);
  });

  test('follows @import into the imported sheet', () => {
    const imported = sheet([styleRule('.imported', 'rtl')]);
    expect(styleSheetDeclaresDirection(sheet([importRule(imported)]))).toBe(true);
  });

  // Permissive on unreadable CSSOM: the caller has its own guarded walk, and a
  // sheet this pre-filter cannot read must not be silently dropped from it.
  test('reports true when the sheet itself denies CSSOM access', () => {
    const denied = {};
    Object.defineProperty(denied, 'cssRules', {
      configurable: true,
      get: () => {
        throw new Error('cross-origin');
      },
    });
    expect(styleSheetDeclaresDirection(denied as CSSStyleSheet)).toBe(true);
  });

  test('reports true when a nested rule denies CSSOM access', () => {
    const denied = { cssText: '@media all {}', type: 4, conditionText: 'all', media: {} };
    Object.defineProperty(denied, 'cssRules', {
      configurable: true,
      get: () => {
        throw new Error('cross-origin');
      },
    });
    expect(styleSheetDeclaresDirection(sheet([denied as unknown as CSSRule]))).toBe(true);
  });

  test('reports true when an imported sheet denies CSSOM access', () => {
    const denied = {};
    Object.defineProperty(denied, 'cssRules', {
      configurable: true,
      get: () => {
        throw new Error('cross-origin');
      },
    });
    expect(styleSheetDeclaresDirection(sheet([importRule(denied)]))).toBe(true);
  });

  test('ignores a direction declaration on a rule that is not a style rule', () => {
    // A keyframe rule has `style` but no `selectorText`; the walk it guards can
    // only ever act on style rules, so neither should this index.
    const keyframe = { cssText: '0% {}', type: 8, keyText: '0%', style: { direction: 'rtl' } };
    expect(styleSheetDeclaresDirection(sheet([keyframe as unknown as CSSRule]))).toBe(false);
  });
});

describe('caching', () => {
  test('does not re-walk nested rules on repeated queries', () => {
    const nestedReads = { reads: 0 };
    const target = sheet([groupRule([styleRule('.a')], nestedReads)]);

    expect(styleSheetDeclaresDirection(target)).toBe(false);
    const afterFirst = nestedReads.reads;
    expect(afterFirst).toBeGreaterThan(0);

    for (let i = 0; i < 25; i++) styleSheetDeclaresDirection(target);
    expect(nestedReads.reads).toBe(afterFirst);
  });

  test('re-walks when the top-level rule count changes', () => {
    const rules: CSSRule[] = [styleRule('.a')];
    const target = sheet(rules);

    expect(styleSheetDeclaresDirection(target)).toBe(false);
    rules.push(styleRule('.b', 'rtl'));
    expect(styleSheetDeclaresDirection(target)).toBe(true);
  });

  test('does not cache a negative result for a sheet containing @import', () => {
    // The imported sheet is still loading on the first query and gains its rules
    // afterwards, without the importer's own rule count changing.
    const importedRules: CSSRule[] = [];
    const imported = sheet(importedRules);
    const target = sheet([importRule(imported)]);

    expect(styleSheetDeclaresDirection(target)).toBe(false);
    importedRules.push(styleRule('.late', 'rtl'));
    expect(styleSheetDeclaresDirection(target)).toBe(true);
  });

  test('caches a positive result even for a sheet containing @import', () => {
    const importedReads = { reads: 0 };
    const imported = sheet([styleRule('.imported', 'rtl')], importedReads);
    const target = sheet([importRule(imported)]);

    expect(styleSheetDeclaresDirection(target)).toBe(true);
    const afterFirst = importedReads.reads;
    for (let i = 0; i < 10; i++) styleSheetDeclaresDirection(target);
    expect(importedReads.reads).toBe(afterFirst);
  });

  test('resetDirectionStyleSheetIndex forces a re-walk', () => {
    const nestedReads = { reads: 0 };
    const target = sheet([groupRule([styleRule('.a')], nestedReads)]);

    styleSheetDeclaresDirection(target);
    const afterFirst = nestedReads.reads;
    styleSheetDeclaresDirection(target);
    expect(nestedReads.reads).toBe(afterFirst);

    resetDirectionStyleSheetIndex();
    styleSheetDeclaresDirection(target);
    expect(nestedReads.reads).toBeGreaterThan(afterFirst);
  });
});

describe('matchesDirectionStyleRule integration', () => {
  const parentOf = (element: HTMLElement) => element.parentElement;

  function withDocumentStyleSheets<T>(styleSheets: unknown[], callback: () => T): T {
    const descriptor = Object.getOwnPropertyDescriptor(document, 'styleSheets');
    Object.defineProperty(document, 'styleSheets', { configurable: true, value: styleSheets });
    try {
      return callback();
    } finally {
      if (descriptor) Object.defineProperty(document, 'styleSheets', descriptor);
      else Reflect.deleteProperty(document, 'styleSheets');
    }
  }

  test('still matches a direction rule that applies to the element', () => {
    const element = document.createElement('div');
    element.className = 'rtl-target';
    document.body.append(element);

    const matched = withDocumentStyleSheets([sheet([styleRule('.rtl-target', 'rtl')])], () =>
      matchesDirectionStyleRule(element, parentOf),
    );
    expect(matched).toBe(true);
  });

  test('still reports no match when the direction rule targets something else', () => {
    const element = document.createElement('div');
    element.className = 'not-me';
    document.body.append(element);

    const matched = withDocumentStyleSheets([sheet([styleRule('.someone-else', 'rtl')])], () =>
      matchesDirectionStyleRule(element, parentOf),
    );
    expect(matched).toBe(false);
  });

  // The regression this whole module exists for: a document that declares no
  // direction anywhere must not be re-walked once per query. Before the index,
  // every call walked every rule of every sheet — measured at ~370ms for a
  // single Dropdown mount in a real app (stevekinney/cinder#1262).
  test('a direction-free document is walked once, not once per query', () => {
    const element = document.createElement('div');
    document.body.append(element);

    const nestedReads = { reads: 0 };
    const sheets = [
      sheet([groupRule([styleRule('.a'), styleRule('.b')], nestedReads)]),
      sheet([styleRule('.c'), styleRule('.d')]),
    ];

    withDocumentStyleSheets(sheets, () => {
      expect(matchesDirectionStyleRule(element, parentOf)).toBe(false);
      const afterFirst = nestedReads.reads;
      expect(afterFirst).toBeGreaterThan(0);

      for (let i = 0; i < 50; i++) {
        expect(matchesDirectionStyleRule(element, parentOf)).toBe(false);
      }
      expect(nestedReads.reads).toBe(afterFirst);
    });
  });
});
