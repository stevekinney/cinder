import { describe, expect, test } from 'bun:test';

import {
  evaluateLogicalContainerCondition,
  isFullyParsedContainerCondition,
  parseStyleQuery,
} from './text-direction-container.ts';
import { hasScopePseudoClass, replaceScopePseudoClass } from './text-direction-css.ts';
import {
  createCssRule,
  createStyleRule,
  createStyleSheetWithRules,
  createStyleSheetWithThrowingRules,
  withDocumentStyleSheets,
} from './text-direction-test-helpers.ts';
import { isContainerRule, resolveTextDirection } from './text-direction.ts';

describe('resolveTextDirection', () => {
  test('recognizes only the actual :scope pseudo-class token', () => {
    expect(hasScopePseudoClass(':scope')).toBe(true);
    expect(hasScopePseudoClass(':SCOPE > .target')).toBe(true);
    expect(hasScopePseudoClass(':scopeX')).toBe(false);
    expect(hasScopePseudoClass(':scoped')).toBe(false);
    expect(replaceScopePseudoClass(':scopeX :scoped', '[data-root]')).toBe(':scopeX :scoped');
    // A backslash-escaped colon is a literal character, not the start of a
    // `:scope` token — the escape state machine must copy both the
    // backslash and the escaped character through untouched rather than
    // matching `:scope` starting one character later.
    expect(replaceScopePseudoClass('\\:scope', '[data-root]')).toBe('\\:scope');
  });

  test('fails closed when a container condition contains unparsed syntax', () => {
    const cases: [string, boolean][] = [
      ['(min-width: 20px)', true],
      ['(max-inline-size: 40rem)', true],
      ['(width: 20px)', true],
      ['(inline-size >= 20rem)', true],
      ['(20rem <= width <= 40rem)', true],
      ['(min-width: 20px) and (max-width: 40rem)', true],
      ['(min-width: 20px) or (max-width: 40rem)', true],
      ['not (min-width: 20px)', true],
      ['not ((min-width: 20px) or (max-width: 40rem))', true],
      ['not min-width: 20px', false],
      ['not(width >= 20px)', false],
      ['(min-width: 20px) unexpected', false],
      ['(width >= 20px) xor (width <= 40px)', false],
      ['foo(width >= 20px)', false],
      ['(min-width: 20px) and (unknown-feature: 1px)', false],
      ['(min-width: 1.2.3px)', false],
      ['min-width: 20px', false],
      ['min-width: 20px and max-width: 40px', false],
      ['(min-width: 20px) and (max-width: 40px) or (width: 100px)', false],
      ['(20px < width > 40px)', false],
      ['not (min-width: 20px) and (max-width: 40rem)', false],
      ['not (min-width: 20px) or (max-width: 40rem)', false],
      ['(not (min-width: 20px)) and (max-width: 40rem)', true],
    ];
    for (const [condition, expected] of cases) {
      expect(isFullyParsedContainerCondition(condition), condition).toBe(expected);
    }
  });

  test('evaluates grouped NOT over OR without treating it as an implicit conjunction', () => {
    const condition = 'not ((min-width: 20px) or (max-width: 10px))';
    expect(evaluateLogicalContainerCondition(condition, 5, 16, 5)).toBe(false);
    expect(evaluateLogicalContainerCondition(condition, 30, 16, 30)).toBe(false);
    expect(evaluateLogicalContainerCondition(condition, 15, 16, 15)).toBe(true);
    expect(evaluateLogicalContainerCondition('not (min-width: 20px)', 10, 16, 10)).toBe(true);
    expect(evaluateLogicalContainerCondition('not (min-width: 20px)', 30, 16, 30)).toBe(false);
    expect(evaluateLogicalContainerCondition('not min-width: 20px', 10, 16, 10)).toBe(false);
    expect(evaluateLogicalContainerCondition('not(width >= 20px)', 10, 16, 10)).toBe(false);
    expect(evaluateLogicalContainerCondition('min-width: 20px', 30, 16, 30)).toBe(false);
    expect(
      evaluateLogicalContainerCondition(
        '(min-width: 20px) and (max-width: 40px) or (width: 100px)',
        30,
        16,
        30,
      ),
    ).toBe(false);
    expect(evaluateLogicalContainerCondition('(20px < width > 40px)', 50, 16, 50)).toBe(false);
  });

  test('fails closed on an ungrouped NOT combined with AND/OR', () => {
    // `not (min-width: 20px) and (max-width: 40px)` is not valid CSS grammar
    // — `<media-and>` requires each operand to be `<media-in-parens>`, and a
    // bare `<media-not>` doesn't qualify without its own wrapping parens.
    // Without the fix this evaluated as `NOT(width >= 20px) AND (width <=
    // 40px)`, wrongly activating below 20px instead of failing closed.
    const ungrouped = 'not (min-width: 20px) and (max-width: 40px)';
    expect(evaluateLogicalContainerCondition(ungrouped, 10, 16, 10)).toBe(false);
    expect(evaluateLogicalContainerCondition(ungrouped, 30, 16, 30)).toBe(false);
    // The grouped equivalent remains valid and evaluates normally.
    const grouped = '(not (min-width: 20px)) and (max-width: 40px)';
    expect(evaluateLogicalContainerCondition(grouped, 10, 16, 10)).toBe(true);
    expect(evaluateLogicalContainerCondition(grouped, 30, 16, 30)).toBe(false);
  });

  test('parseStyleQuery returns undefined for an unbalanced style() term', () => {
    expect(parseStyleQuery('style(--x: (unclosed')).toBeUndefined();
  });

  test('resolves a value-first range comparison using the < operator', () => {
    // Feature-first `<` is exercised elsewhere; this pins the value-first
    // mirror, which the operand-flip ternary maps to `>`.
    expect(evaluateLogicalContainerCondition('(20rem < width)', 400, 16, 400)).toBe(true);
    expect(evaluateLogicalContainerCondition('(20rem < width)', 100, 16, 100)).toBe(false);
  });

  test('resolves a value-first range comparison using the >= operator', () => {
    // Maps to `<=`.
    expect(evaluateLogicalContainerCondition('(20rem >= width)', 300, 16, 300)).toBe(true);
    expect(evaluateLogicalContainerCondition('(20rem >= width)', 400, 16, 400)).toBe(false);
  });

  test('resolves a value-first range comparison using the > operator', () => {
    // Falls through the ternary's final else, mapping to `<` — also the
    // fallback branch of the comparison evaluator itself.
    expect(evaluateLogicalContainerCondition('(20rem > width)', 100, 16, 100)).toBe(true);
    expect(evaluateLogicalContainerCondition('(20rem > width)', 400, 16, 400)).toBe(false);
  });

  test('evaluates a compound width + inline-size condition joined by "and"', () => {
    expect(
      evaluateLogicalContainerCondition(
        '(min-width: 300px) and (min-inline-size: 200px)',
        320,
        16,
        250,
      ),
    ).toBe(true);
    expect(
      evaluateLogicalContainerCondition(
        '(min-width: 300px) and (min-inline-size: 200px)',
        320,
        16,
        100,
      ),
    ).toBe(false);
  });

  test('only treats unknown CSS rules with container at-rule text as container rules', () => {
    const unknownRule = createCssRule({ cssText: '@unknown (min-width: 1px) {}', type: 0 });
    const containerRule = createCssRule({
      cssText: '@container (min-width: 1px) {}',
      type: 0,
    });
    expect(isContainerRule(unknownRule)).toBe(false);
    expect(isContainerRule(containerRule)).toBe(true);
  });
  test('skips a rule whose parent selector cannot be read, rather than throwing', () => {
    const element = document.createElement('div');
    element.className = 'unreachable-because-parent-throws';
    document.body.append(element);
    const throwingParent: unknown = {};
    Object.defineProperty(throwingParent, 'selectorText', {
      get(): string {
        throw new Error('cannot read parent selector');
      },
    });
    const nestedRule = createStyleRule({
      selectorText: '.unreachable-because-parent-throws',
      direction: 'ltr',
    });
    Object.defineProperty(nestedRule, 'parentRule', { value: throwingParent, configurable: true });
    expect(
      withDocumentStyleSheets([{ cssRules: [nestedRule] }], () =>
        resolveTextDirection(element, 'rtl'),
      ),
    ).toBe('rtl');
    element.remove();
  });

  test('fails closed on an @scope prelude with no rule body to terminate it', () => {
    // `findScopePreludeEnd` scans forward from `@scope` looking for the `{`
    // that starts the rule body, tracking paren/bracket depth as it goes.
    // When the scanned text runs out before a top-level `{` appears (no
    // rule body at all — cssText not shaped like a real parsed CSSRule),
    // the loop exhausts without an early return and falls through to the
    // trailing `return -1`. `parseScopePrelude` then reports no prelude,
    // and the scope must never activate rather than throw or match.
    const theme = document.createElement('section');
    theme.className = 'theme';
    const target = document.createElement('div');
    target.className = 'shell';
    theme.append(target);
    document.body.append(theme);
    const scopeRule = createCssRule({
      type: 0,
      cssText: '@scope (.theme)',
      cssRules: [createStyleRule({ selectorText: '.shell', direction: 'ltr' })],
    });
    expect(
      withDocumentStyleSheets([{ cssRules: [scopeRule] }], () =>
        resolveTextDirection(target, 'rtl'),
      ),
    ).toBe('rtl');
    theme.remove();
  });

  test('follows an @import rule to match a direction rule inside the imported stylesheet', () => {
    const element = document.createElement('div');
    element.className = 'imported-target';
    document.body.append(element);
    const importedStyleRule = createStyleRule({
      selectorText: '.imported-target',
      direction: 'ltr',
    });
    const importRule = createCssRule({
      type: 3,
      cssText: '@import url("theme.css");',
      styleSheet: createStyleSheetWithRules([importedStyleRule]),
    });
    expect(
      withDocumentStyleSheets([{ cssRules: [importRule] }], () =>
        resolveTextDirection(element, 'rtl'),
      ),
    ).toBe('ltr');
    element.remove();
  });

  test('treats a cross-origin @import whose cssRules access throws as inert, not a match', () => {
    const element = document.createElement('div');
    element.className = 'cross-origin-import-target';
    document.body.append(element);
    const importRule = createCssRule({
      type: 3,
      cssText: '@import url("https://cross-origin.example/theme.css");',
      styleSheet: createStyleSheetWithThrowingRules(),
    });
    // A rule following the failed import still gets evaluated — the import
    // being inert must not abort the whole rule list.
    const fallbackRule = createStyleRule({
      selectorText: '.cross-origin-import-target',
      direction: 'ltr',
    });
    expect(
      withDocumentStyleSheets([{ cssRules: [importRule, fallbackRule] }], () =>
        resolveTextDirection(element, 'rtl'),
      ),
    ).toBe('ltr');
    element.remove();
  });
});
