import { describe, expect, test } from 'bun:test';

import { matchesDirectionStyleRule } from './text-direction-css.ts';
import {
  createCssRule,
  createStyleRule,
  withComputedDirection,
  withDocumentStyleSheets,
} from './text-direction-test-helpers.ts';
import { resolveTextDirection } from './text-direction.ts';

describe('resolveTextDirection', () => {
  test('matches the scope root itself when the selector is :scope', () => {
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
      cssRules: [createStyleRule({ selectorText: ':scope', direction: 'ltr' })],
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

  test('does not broaden an exact :scope scope-start beyond its stylesheet root', () => {
    const section = document.createElement('section');
    const styleElement = document.createElement('style');
    const target = document.createElement('div');
    target.className = 'shell';
    section.append(styleElement);
    document.body.append(section, target);
    const scopeRule = createCssRule({
      type: 0,
      cssText: '@scope (:scope) {}',
      cssRules: [createStyleRule({ selectorText: '.shell', direction: 'ltr' })],
    });
    expect(
      withDocumentStyleSheets([{ cssRules: [scopeRule], ownerNode: styleElement }], () =>
        matchesDirectionStyleRule(target, (parent) => parent.parentElement),
      ),
    ).toBe(false);
  });

  test('retains ordinary roots in mixed :scope root lists', () => {
    const theme = document.createElement('section');
    theme.className = 'theme';
    const target = document.createElement('div');
    target.className = 'shell';
    theme.append(target);
    document.body.append(theme);
    const scopeRule = createCssRule({
      type: 0,
      cssText: '@scope (:scope, .theme) {}',
      cssRules: [createStyleRule({ selectorText: '.shell', direction: 'ltr' })],
    });
    expect(
      withDocumentStyleSheets([{ cssRules: [scopeRule] }], () =>
        resolveTextDirection(target, 'rtl'),
      ),
    ).toBe('ltr');
  });

  test('does not activate the implicit root for an unsupported scope-pseudo selector', () => {
    // `:scope > .foo` IS now resolved (see the relative-`:scope`-root tests
    // below) — this stays 'rtl' because nothing at the top level is a
    // direct child of the implicit root matching `.foo`, and `.theme`
    // doesn't match anywhere either. It's a genuine non-match, not an
    // unsupported-selector short-circuit.
    const target = document.createElement('div');
    target.className = 'shell';
    document.body.append(target);
    const scopeRule = createCssRule({
      type: 0,
      cssText: '@scope (:scope > .foo, .theme) {}',
      cssRules: [createStyleRule({ selectorText: '.shell', direction: 'ltr' })],
    });
    expect(
      withDocumentStyleSheets([{ cssRules: [scopeRule] }], () =>
        resolveTextDirection(target, 'rtl'),
      ),
    ).toBe('rtl');
  });

  test('preserves the exact :scope alternative in an all-:scope root list when the other alternative cannot resolve', () => {
    // `@scope (:scope, :scope > .theme)` — the relative `:scope > .theme`
    // alternative doesn't structurally resolve to anything here (nothing
    // named `.theme` is a direct child of the implicit scope root), but the
    // supported exact `:scope` alternative must still independently
    // activate the scope. Previously, ANY non-exact `:scope`-containing
    // root selector in an all-`:scope` list (no ordinary selector to fall
    // back on) caused the whole prelude to fail closed, losing the exact
    // alternative too.
    const target = document.createElement('div');
    target.className = 'shell';
    document.body.append(target);
    const scopeRule = createCssRule({
      type: 0,
      cssText: '@scope (:scope, :scope > .theme) {}',
      cssRules: [createStyleRule({ selectorText: '.shell', direction: 'ltr' })],
    });
    expect(
      withDocumentStyleSheets([{ cssRules: [scopeRule] }], () =>
        resolveTextDirection(target, 'rtl'),
      ),
    ).toBe('ltr');
  });

  test('uses the document root for exact :scope scopes in document stylesheets', () => {
    const target = document.createElement('div');
    target.className = 'shell';
    document.body.append(target);
    const scopeRule = createCssRule({
      type: 0,
      cssText: '@scope (:scope) {}',
      cssRules: [createStyleRule({ selectorText: '.shell', direction: 'ltr' })],
    });
    expect(
      withDocumentStyleSheets([{ cssRules: [scopeRule] }], () =>
        resolveTextDirection(target, 'rtl'),
      ),
    ).toBe('ltr');
  });

  test('does not match descendants for a cloned :scope selector', () => {
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
    const descendant = document.createElement('div');
    root.append(descendant);
    Object.defineProperty(root, 'querySelector', { value: () => null });
    document.body.append(root);
    const scopeRule = createCssRule({
      type: 0,
      cssText: '@scope (.theme) {}',
      cssRules: [createStyleRule({ selectorText: ':scope', direction: 'ltr' })],
    });
    try {
      expect(
        withDocumentStyleSheets([{ cssRules: [scopeRule] }], () =>
          matchesDirectionStyleRule(descendant, (parent) => parent.parentElement),
        ),
      ).toBe(false);
    } finally {
      window.getComputedStyle = originalWindowGetComputedStyle;
      globalThis.getComputedStyle = originalGlobalGetComputedStyle;
    }
  });

  test('fails closed for :scope selectors without an active scope context', () => {
    const originalWindowGetComputedStyle = window.getComputedStyle;
    const originalGlobalGetComputedStyle = globalThis.getComputedStyle;
    const getComputedStyleOverride = ((target: Element) => {
      let style = originalWindowGetComputedStyle(target);
      style = withComputedDirection(style, 'ltr');
      return style;
    }) as typeof window.getComputedStyle;
    window.getComputedStyle = getComputedStyleOverride;
    globalThis.getComputedStyle = getComputedStyleOverride;
    const target = document.createElement('div');
    target.className = 'shell';
    document.body.append(target);
    const topLevelRule = createStyleRule({ selectorText: ':scope .shell', direction: 'ltr' });
    const scopedRootRule = createCssRule({
      type: 0,
      cssText: '@scope (:scope > .theme) {}',
      cssRules: [createStyleRule({ selectorText: '.shell', direction: 'ltr' })],
    });
    try {
      expect(
        withDocumentStyleSheets([{ cssRules: [topLevelRule] }], () =>
          resolveTextDirection(target, 'rtl'),
        ),
      ).toBe('rtl');
      expect(
        withDocumentStyleSheets([{ cssRules: [scopedRootRule] }], () =>
          resolveTextDirection(target, 'rtl'),
        ),
      ).toBe('rtl');
    } finally {
      window.getComputedStyle = originalWindowGetComputedStyle;
      globalThis.getComputedStyle = originalGlobalGetComputedStyle;
    }
  });
});
