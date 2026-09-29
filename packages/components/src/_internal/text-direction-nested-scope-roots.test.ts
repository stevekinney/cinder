import { describe, expect, test } from 'bun:test';

import {
  createCssRule,
  createStyleRule,
  withComputedDirection,
  withDocumentStyleSheets,
} from './text-direction-test-helpers.ts';
import { resolveTextDirection } from './text-direction.ts';

describe('resolveTextDirection', () => {
  test('binds a nested exact :scope root to the enclosing scope, not the stylesheet root', () => {
    const originalWindowGetComputedStyle = window.getComputedStyle;
    const originalGlobalGetComputedStyle = globalThis.getComputedStyle;
    const getComputedStyleOverride = ((target: Element) => {
      let style = originalWindowGetComputedStyle(target);
      style = withComputedDirection(style, 'ltr');
      return style;
    }) as typeof window.getComputedStyle;
    window.getComputedStyle = getComputedStyleOverride;
    globalThis.getComputedStyle = getComputedStyleOverride;
    const parent = document.createElement('section');
    parent.className = 'parent';
    const target = document.createElement('div');
    target.className = 'shell';
    parent.append(target);
    document.body.append(parent);
    const innerScope = createCssRule({
      type: 0,
      cssText: '@scope (:scope) {}',
      cssRules: [createStyleRule({ selectorText: '.shell', direction: 'ltr' })],
    });
    const outerScope = createCssRule({
      type: 0,
      cssText: '@scope (.parent) {}',
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

  test('binds a nested exact :scope root to an enclosing ShadowRoot scope root', () => {
    // Same shape as the previous test, but the ENCLOSING scope's root is
    // itself a `ShadowRoot` (the implicit root of a shadow-owned
    // stylesheet — see 'uses the enclosing shadow root as the implicit
    // scope root' above), not an `Element`. `findRelativeScopeRootMatches`
    // used to walk only `parentElement` ancestors, so a `ShadowRoot`
    // candidate was silently unreachable and the inner `@scope (:scope)`
    // never activated.
    const originalWindowGetComputedStyle = window.getComputedStyle;
    const originalGlobalGetComputedStyle = globalThis.getComputedStyle;
    const getComputedStyleOverride = ((target: Element) => {
      let style = originalWindowGetComputedStyle(target);
      style = withComputedDirection(style, 'ltr');
      return style;
    }) as typeof window.getComputedStyle;
    window.getComputedStyle = getComputedStyleOverride;
    globalThis.getComputedStyle = getComputedStyleOverride;
    const host = document.createElement('div');
    const shadowRoot = host.attachShadow({ mode: 'open' });
    const styleElement = document.createElement('style');
    const target = document.createElement('div');
    target.className = 'shell';
    shadowRoot.append(styleElement, target);
    document.body.append(host);
    const innerScope = createCssRule({
      type: 0,
      cssText: '@scope (:scope) {}',
      cssRules: [createStyleRule({ selectorText: '.shell', direction: 'ltr' })],
    });
    const outerScope = createCssRule({
      type: 0,
      cssText: '@scope {}',
      cssRules: [innerScope],
    });
    try {
      expect(
        withDocumentStyleSheets([{ cssRules: [outerScope], ownerNode: styleElement }], () =>
          resolveTextDirection(target, 'rtl'),
        ),
      ).toBe('ltr');
    } finally {
      window.getComputedStyle = originalWindowGetComputedStyle;
      globalThis.getComputedStyle = originalGlobalGetComputedStyle;
    }
  });

  test('binds a nested exact :scope root to an enclosing ShadowRoot root for an adopted stylesheet', () => {
    // Same bug as the previous test, but for an ownerless ADOPTED
    // stylesheet — `getImplicitScopeRoot` reaches the `ShadowRoot` via the
    // sheet's shadow-root association (`fallbackRoot`) instead of walking
    // up from an `ownerNode`, which is likewise a `ShadowRoot` the
    // enclosing scope's root must resolve to.
    const originalWindowGetComputedStyle = window.getComputedStyle;
    const originalGlobalGetComputedStyle = globalThis.getComputedStyle;
    const getComputedStyleOverride = ((target: Element) => {
      let style = originalWindowGetComputedStyle(target);
      style = withComputedDirection(style, 'ltr');
      return style;
    }) as typeof window.getComputedStyle;
    window.getComputedStyle = getComputedStyleOverride;
    globalThis.getComputedStyle = getComputedStyleOverride;
    try {
      const host = document.createElement('div');
      const shadowRoot = host.attachShadow({ mode: 'open' });
      const target = document.createElement('div');
      target.className = 'shell';
      shadowRoot.append(target);
      document.body.append(host);
      const innerScope = createCssRule({
        type: 0,
        cssText: '@scope (:scope) {}',
        cssRules: [createStyleRule({ selectorText: '.shell', direction: 'ltr' })],
      });
      const outerScope = {
        type: 0,
        cssText: '@scope {}',
        cssRules: [innerScope],
      };
      Object.defineProperty(shadowRoot, 'adoptedStyleSheets', {
        configurable: true,
        value: [{ cssRules: [outerScope] }],
      });
      expect(resolveTextDirection(target, 'rtl')).toBe('ltr');
    } finally {
      window.getComputedStyle = originalWindowGetComputedStyle;
      globalThis.getComputedStyle = originalGlobalGetComputedStyle;
    }
  });

  test('binds a nested relative :scope root selector to the enclosing scope root', () => {
    // `@scope (.parent) { @scope (:scope > .child) { .shell { … } } }` — a
    // relative (non-exact) `:scope` scope-start selector attached to a
    // combinator must resolve by testing candidate ancestors of the target
    // against the enclosing scope's root(s), not fail closed just because
    // it isn't the bare `:scope` token.
    const parent = document.createElement('section');
    parent.className = 'parent';
    const child = document.createElement('div');
    child.className = 'child';
    const target = document.createElement('div');
    target.className = 'shell';
    child.append(target);
    parent.append(child);
    document.body.append(parent);
    const innerScope = createCssRule({
      type: 0,
      cssText: '@scope (:scope > .child) {}',
      cssRules: [createStyleRule({ selectorText: '.shell', direction: 'ltr' })],
    });
    const outerScope = createCssRule({
      type: 0,
      cssText: '@scope (.parent) {}',
      cssRules: [innerScope],
    });
    expect(
      withDocumentStyleSheets([{ cssRules: [outerScope] }], () =>
        resolveTextDirection(target, 'rtl'),
      ),
    ).toBe('ltr');
  });

  test('does not promote a coincidentally-shaped descendant as a relative :scope root match', () => {
    // Regression guard for the resolution mechanism itself: the enclosing
    // scope's root (`.parent`) has no direct child matching `.child` — its
    // real direct child is a plain wrapper `<div>`. A DIFFERENT, deeper
    // descendant happens to be shaped identically (same tag, same
    // first-child position relative to its own real parent) and DOES have a
    // direct child named `.child`. Root resolution must use the real
    // ancestor/DOM relationship, not a structural coincidence, or this
    // would incorrectly promote the deeper element's child as a scope root.
    const parent = document.createElement('section');
    parent.className = 'parent';
    const wrapperDiv = document.createElement('div');
    const decoy = document.createElement('section');
    const child = document.createElement('div');
    child.className = 'child';
    const target = document.createElement('div');
    target.className = 'shell';
    child.append(target);
    decoy.append(child);
    wrapperDiv.append(decoy);
    parent.append(wrapperDiv);
    document.body.append(parent);
    const innerScope = createCssRule({
      type: 0,
      cssText: '@scope (:scope > .child) {}',
      cssRules: [createStyleRule({ selectorText: '.shell', direction: 'ltr' })],
    });
    const outerScope = createCssRule({
      type: 0,
      cssText: '@scope (.parent) {}',
      cssRules: [innerScope],
    });
    expect(
      withDocumentStyleSheets([{ cssRules: [outerScope] }], () =>
        resolveTextDirection(target, 'rtl'),
      ),
    ).toBe('rtl');
  });
});
