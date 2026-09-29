import { describe, expect, test } from 'bun:test';

import {
  createCssRule,
  createStyleRule,
  withDocumentStyleSheets,
} from './text-direction-test-helpers.ts';
import { resolveTextDirection } from './text-direction.ts';

describe('resolveTextDirection', () => {
  test('resolves outside-ancestor context for a scoped rule selector', () => {
    // `@scope (.theme) { main :scope .shell { … } }` — `main` describes
    // context OUTSIDE the scope root, which the clone-based matcher (which
    // only ever clones the root's own subtree) can never see on its own.
    // The outside portion must be verified against the scope root's real,
    // unmutated, uncloned ancestor chain instead.
    const main = document.createElement('main');
    const theme = document.createElement('section');
    theme.className = 'theme';
    const target = document.createElement('div');
    target.className = 'shell';
    theme.append(target);
    main.append(theme);
    document.body.append(main);
    const scopeRule = createCssRule({
      type: 0,
      cssText: '@scope (.theme) {}',
      cssRules: [createStyleRule({ selectorText: 'main :scope .shell', direction: 'ltr' })],
    });
    expect(
      withDocumentStyleSheets([{ cssRules: [scopeRule] }], () =>
        resolveTextDirection(target, 'rtl'),
      ),
    ).toBe('ltr');
  });

  test('does not satisfy outside-ancestor context via a coincidentally-shaped descendant', () => {
    // Regression guard for the outside-context check itself: the scope root
    // (`.theme`) has NO `main` ancestor at all. A deeper descendant happens
    // to share the root's exact tag+position shape AND does have a `main`
    // ancestor (inserted between the root and that descendant). The
    // outside-ancestor check must verify the ROOT's own real ancestor
    // chain specifically, not any coincidentally-shaped descendant's.
    const outerDiv = document.createElement('div');
    const theme = document.createElement('section');
    theme.className = 'theme';
    const main = document.createElement('main');
    const decoy = document.createElement('section');
    const target = document.createElement('div');
    target.className = 'shell';
    decoy.append(target);
    main.append(decoy);
    theme.append(main);
    outerDiv.append(theme);
    document.body.append(outerDiv);
    const scopeRule = createCssRule({
      type: 0,
      cssText: '@scope (.theme) {}',
      cssRules: [createStyleRule({ selectorText: 'main :scope .shell', direction: 'ltr' })],
    });
    expect(
      withDocumentStyleSheets([{ cssRules: [scopeRule] }], () =>
        resolveTextDirection(target, 'rtl'),
      ),
    ).toBe('rtl');
  });

  test('uses native :scope querySelector support when the environment provides it', () => {
    // happy-dom has no native `:scope` support, so this module falls back to
    // a clone-based matcher everywhere else in this file's tests. Stubbing
    // `querySelector`/`querySelectorAll` here simulates a real browser that
    // DOES support `:scope` natively, exercising the fast path that skips
    // the clone entirely.
    const theme = document.createElement('section');
    theme.className = 'theme';
    const target = document.createElement('div');
    target.className = 'shell';
    theme.append(target);
    document.body.append(theme);

    const originalQuerySelector = Element.prototype.querySelector;
    const originalQuerySelectorAll = Element.prototype.querySelectorAll;
    Element.prototype.querySelector = function (this: Element, selector: string) {
      if (selector === ':scope') return this;
      return originalQuerySelector.call(this, selector);
    };
    Element.prototype.querySelectorAll = function (this: Element, selector: string) {
      // Approximate native `:scope`-relative matching for this test's one
      // selector shape by resolving it against the scope root directly.
      if (selector === ':scope .shell') return originalQuerySelectorAll.call(this, '.shell');
      return originalQuerySelectorAll.call(this, selector);
    };

    try {
      const scopeRule = createCssRule({
        type: 0,
        cssText: '@scope (.theme) {}',
        cssRules: [createStyleRule({ selectorText: ':scope .shell', direction: 'ltr' })],
      });
      expect(
        withDocumentStyleSheets([{ cssRules: [scopeRule] }], () =>
          resolveTextDirection(target, 'rtl'),
        ),
      ).toBe('ltr');
    } finally {
      Element.prototype.querySelector = originalQuerySelector;
      Element.prototype.querySelectorAll = originalQuerySelectorAll;
      theme.remove();
    }
  });

  test('fails closed on an @scope prelude whose bracket/paren nesting cannot be resolved into a group', () => {
    // `parseScopePrelude`'s own outer scan tracks parens and brackets as two
    // fully independent counters (a `)` always closes a paren, whatever the
    // current bracket depth), so it sees `([)]` as net-balanced and accepts
    // the prelude. But the group-unwrapping scan only counts a `)` as
    // closing a paren when brackets === 0 — here the `)` lands while a
    // bracket is still open, so it's never counted, and paren depth never
    // returns to 0. The scope must fail closed rather than throw or match
    // anything.
    const theme = document.createElement('section');
    theme.className = 'theme';
    const target = document.createElement('div');
    target.className = 'shell';
    theme.append(target);
    document.body.append(theme);
    const scopeRule = createCssRule({
      type: 0,
      cssText: '@scope ([)] {}',
      cssRules: [createStyleRule({ selectorText: '.shell', direction: 'ltr' })],
    });
    expect(
      withDocumentStyleSheets([{ cssRules: [scopeRule] }], () =>
        resolveTextDirection(target, 'rtl'),
      ),
    ).toBe('rtl');
    theme.remove();
  });

  test('resolves a direct-child combinator (>) immediately before :scope', () => {
    const parent = document.createElement('div');
    parent.className = 'parent';
    const theme = document.createElement('section');
    theme.className = 'theme';
    const target = document.createElement('div');
    target.className = 'shell';
    theme.append(target);
    parent.append(theme);
    document.body.append(parent);
    const scopeRule = createCssRule({
      type: 0,
      cssText: '@scope (.theme) {}',
      cssRules: [createStyleRule({ selectorText: '.parent > :scope .shell', direction: 'ltr' })],
    });
    expect(
      withDocumentStyleSheets([{ cssRules: [scopeRule] }], () =>
        resolveTextDirection(target, 'rtl'),
      ),
    ).toBe('ltr');
  });

  test('resolves an adjacent-sibling combinator (+) immediately before :scope', () => {
    const wrapper = document.createElement('div');
    const adjacent = document.createElement('div');
    adjacent.className = 'adjacent';
    const theme = document.createElement('section');
    theme.className = 'theme';
    const target = document.createElement('div');
    target.className = 'shell';
    theme.append(target);
    wrapper.append(adjacent, theme);
    document.body.append(wrapper);
    const scopeRule = createCssRule({
      type: 0,
      cssText: '@scope (.theme) {}',
      cssRules: [createStyleRule({ selectorText: '.adjacent + :scope .shell', direction: 'ltr' })],
    });
    expect(
      withDocumentStyleSheets([{ cssRules: [scopeRule] }], () =>
        resolveTextDirection(target, 'rtl'),
      ),
    ).toBe('ltr');
  });

  test('resolves a general-sibling combinator (~) immediately before :scope', () => {
    const wrapper = document.createElement('div');
    const earlier = document.createElement('div');
    earlier.className = 'earlier';
    const between = document.createElement('div');
    const theme = document.createElement('section');
    theme.className = 'theme';
    const target = document.createElement('div');
    target.className = 'shell';
    theme.append(target);
    // `between` sits between `earlier` and the scope root, proving `~`
    // walks every preceding sibling rather than only the immediate one.
    wrapper.append(earlier, between, theme);
    document.body.append(wrapper);
    const scopeRule = createCssRule({
      type: 0,
      cssText: '@scope (.theme) {}',
      cssRules: [createStyleRule({ selectorText: '.earlier ~ :scope .shell', direction: 'ltr' })],
    });
    expect(
      withDocumentStyleSheets([{ cssRules: [scopeRule] }], () =>
        resolveTextDirection(target, 'rtl'),
      ),
    ).toBe('ltr');
  });

  test('treats a scope combinator with nothing before it as no outside-ancestor context', () => {
    const theme = document.createElement('section');
    theme.className = 'theme';
    const target = document.createElement('div');
    target.className = 'shell';
    theme.append(target);
    document.body.append(theme);
    const scopeRule = createCssRule({
      type: 0,
      cssText: '@scope (.theme) {}',
      cssRules: [createStyleRule({ selectorText: '> :scope .shell', direction: 'ltr' })],
    });
    expect(
      withDocumentStyleSheets([{ cssRules: [scopeRule] }], () =>
        resolveTextDirection(target, 'rtl'),
      ),
    ).toBe('rtl');
    theme.remove();
  });
});
