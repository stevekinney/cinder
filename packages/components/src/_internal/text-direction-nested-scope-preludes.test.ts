import { describe, expect, test } from 'bun:test';

import {
  createCssRule,
  createStyleRule,
  withComputedDirection,
  withDocumentStyleSheets,
} from './text-direction-test-helpers.ts';
import { resolveTextDirection } from './text-direction.ts';

describe('resolveTextDirection', () => {
  test('parses nested functional roots and limits in scope preludes', () => {
    const originalWindowGetComputedStyle = window.getComputedStyle;
    const originalGlobalGetComputedStyle = globalThis.getComputedStyle;
    const getComputedStyleOverride = ((target: Element) => {
      let style = originalWindowGetComputedStyle(target);
      style = withComputedDirection(style, 'ltr');
      return style;
    }) as typeof window.getComputedStyle;
    window.getComputedStyle = getComputedStyleOverride;
    globalThis.getComputedStyle = getComputedStyleOverride;
    const root = document.createElement('div');
    root.className = 'theme';
    const element = document.createElement('div');
    element.className = 'shell stop';
    root.append(element);
    document.body.append(root);
    const styleRule = createStyleRule({ selectorText: '.shell', direction: 'ltr' });
    const scopeRule = createCssRule({
      type: 0,
      cssText: '@scope (:is(.theme, .alt)) to (:is(.stop, .halt)) {}',
      cssRules: [styleRule],
    });
    try {
      expect(
        withDocumentStyleSheets([{ cssRules: [scopeRule] }], () =>
          resolveTextDirection(element, 'rtl'),
        ),
      ).toBe('rtl');
    } finally {
      window.getComputedStyle = originalWindowGetComputedStyle;
      globalThis.getComputedStyle = originalGlobalGetComputedStyle;
    }
  });

  test('treats a bare & as an alias for the scope root', () => {
    const originalWindowGetComputedStyle = window.getComputedStyle;
    const originalGlobalGetComputedStyle = globalThis.getComputedStyle;
    const getComputedStyleOverride = ((target: Element) => {
      let style = originalWindowGetComputedStyle(target);
      style = withComputedDirection(style, 'ltr');
      return style;
    }) as typeof window.getComputedStyle;
    window.getComputedStyle = getComputedStyleOverride;
    globalThis.getComputedStyle = getComputedStyleOverride;
    const root = document.createElement('section');
    root.className = 'theme';
    document.body.append(root);
    const scopeRule = createCssRule({
      type: 0,
      cssText: '@scope (.theme) {}',
      cssRules: [createStyleRule({ selectorText: '&', direction: 'ltr' })],
    });
    try {
      expect(
        withDocumentStyleSheets([{ cssRules: [scopeRule] }], () =>
          resolveTextDirection(root, 'rtl'),
        ),
      ).toBe('ltr');
    } finally {
      window.getComputedStyle = originalWindowGetComputedStyle;
      globalThis.getComputedStyle = originalGlobalGetComputedStyle;
    }
  });
  test('treats a leading combinator as relative to the scope root', () => {
    const originalWindowGetComputedStyle = window.getComputedStyle;
    const originalGlobalGetComputedStyle = globalThis.getComputedStyle;
    const getComputedStyleOverride = ((target: Element) => {
      let style = originalWindowGetComputedStyle(target);
      style = withComputedDirection(style, 'ltr');
      return style;
    }) as typeof window.getComputedStyle;
    window.getComputedStyle = getComputedStyleOverride;
    globalThis.getComputedStyle = getComputedStyleOverride;
    const root = document.createElement('section');
    root.className = 'theme';
    const child = document.createElement('div');
    child.className = 'shell';
    // `element.matches('> .shell')` is not merely unmatched in a
    // spec-compliant engine — it's an invalid selector, and some engines
    // (including this suite's DOM shim) parse it leniently by dropping the
    // leading combinator, matching `.shell` at any depth instead of
    // rejecting it. A grandchild pins the correctly-scoped behavior against
    // that false positive: `> .shell` must bind to the scope root as
    // "direct child", so it may match `child` but must not match
    // `grandchild`.
    const middle = document.createElement('div');
    const grandchild = document.createElement('div');
    grandchild.className = 'shell';
    middle.append(grandchild);
    root.append(child, middle);
    document.body.append(root);
    const scopeRule = createCssRule({
      type: 0,
      cssText: '@scope (.theme) {}',
      cssRules: [createStyleRule({ selectorText: '> .shell', direction: 'ltr' })],
    });
    try {
      expect(
        withDocumentStyleSheets([{ cssRules: [scopeRule] }], () =>
          resolveTextDirection(child, 'rtl'),
        ),
      ).toBe('ltr');
      expect(
        withDocumentStyleSheets([{ cssRules: [scopeRule] }], () =>
          resolveTextDirection(grandchild, 'rtl'),
        ),
      ).toBe('rtl');
    } finally {
      window.getComputedStyle = originalWindowGetComputedStyle;
      globalThis.getComputedStyle = originalGlobalGetComputedStyle;
    }
  });

  test('normalizes each item of a rule selector list independently for leading combinators', () => {
    // `.unused, > .shell` — only the SECOND alternative needs its leading
    // combinator rewritten to `:scope > .shell`; normalization must operate
    // per comma-separated item, not gate on whether the whole list starts
    // with a combinator (the list as a whole starts with `.unused`, so a
    // whole-string check would leave the second alternative untouched).
    const root = document.createElement('section');
    root.className = 'theme';
    const child = document.createElement('div');
    child.className = 'shell';
    root.append(child);
    document.body.append(root);
    const scopeRule = createCssRule({
      type: 0,
      cssText: '@scope (.theme) {}',
      cssRules: [createStyleRule({ selectorText: '.unused, > .shell', direction: 'ltr' })],
    });
    expect(
      withDocumentStyleSheets([{ cssRules: [scopeRule] }], () =>
        resolveTextDirection(child, 'rtl'),
      ),
    ).toBe('ltr');
  });

  test('does not create a limit element for a limit that references :scope', () => {
    const originalWindowGetComputedStyle = window.getComputedStyle;
    const originalGlobalGetComputedStyle = globalThis.getComputedStyle;
    const getComputedStyleOverride = ((target: Element) => {
      let style = originalWindowGetComputedStyle(target);
      style = withComputedDirection(style, 'ltr');
      return style;
    }) as typeof window.getComputedStyle;
    window.getComputedStyle = getComputedStyleOverride;
    globalThis.getComputedStyle = getComputedStyleOverride;
    const root = document.createElement('section');
    root.className = 'theme';
    const element = document.createElement('div');
    element.className = 'shell';
    root.append(element);
    document.body.append(root);
    const scopeRule = createCssRule({
      type: 0,
      cssText: '@scope (.theme) to (:scope) {}',
      cssRules: [createStyleRule({ selectorText: '.shell', direction: 'ltr' })],
    });
    try {
      expect(
        withDocumentStyleSheets([{ cssRules: [scopeRule] }], () =>
          resolveTextDirection(element, 'rtl'),
        ),
      ).toBe('ltr');
    } finally {
      window.getComputedStyle = originalWindowGetComputedStyle;
      globalThis.getComputedStyle = originalGlobalGetComputedStyle;
    }
  });

  test('binds an unrooted nested scope to the enclosing scope root, not the document', () => {
    const originalWindowGetComputedStyle = window.getComputedStyle;
    const originalGlobalGetComputedStyle = globalThis.getComputedStyle;
    const getComputedStyleOverride = ((target: Element) => {
      let style = originalWindowGetComputedStyle(target);
      style = withComputedDirection(style, 'ltr');
      return style;
    }) as typeof window.getComputedStyle;
    window.getComputedStyle = getComputedStyleOverride;
    globalThis.getComputedStyle = getComputedStyleOverride;
    const outer = document.createElement('section');
    outer.className = 'outer';
    const target = document.createElement('div');
    target.className = 'shell';
    outer.append(target);
    document.body.append(outer);
    const innerScope = createCssRule({
      type: 0,
      cssText: '@scope {}',
      cssRules: [createStyleRule({ selectorText: '.shell', direction: 'ltr' })],
    });
    const outerScope = createCssRule({
      type: 0,
      cssText: '@scope (.outer) {}',
      cssRules: [innerScope],
    });
    try {
      expect(
        withDocumentStyleSheets([{ cssRules: [outerScope] }], () =>
          resolveTextDirection(target, 'rtl'),
        ),
      ).toBe('ltr');
    } finally {
      window.getComputedStyle = originalWindowGetComputedStyle;
      globalThis.getComputedStyle = originalGlobalGetComputedStyle;
    }
  });
});
