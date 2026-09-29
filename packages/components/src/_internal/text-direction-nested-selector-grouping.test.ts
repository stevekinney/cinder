import { describe, expect, test } from 'bun:test';

import {
  createStyleRule,
  withComputedDirection,
  withDocumentStyleSheets,
} from './text-direction-test-helpers.ts';
import { elementDirectionStyleOverride, resolveTextDirection } from './text-direction.ts';

describe('resolveTextDirection', () => {
  test('preserves parent selector-list grouping when resolving nesting', () => {
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
      const shell = document.createElement('section');
      shell.className = 'selector-list-first';
      const element = document.createElement('div');
      element.className = 'selector-list-menu';
      shell.appendChild(element);
      document.body.appendChild(shell);

      const nestedRule = createStyleRule({
        selectorText: '& .selector-list-menu',
        direction: 'ltr',
      });
      const outerRule = createStyleRule({
        selectorText: '.selector-list-first, .selector-list-second',
        cssRules: [nestedRule],
      });
      Object.defineProperty(nestedRule, 'parentRule', { configurable: true, value: outerRule });

      expect(
        withDocumentStyleSheets([{ cssRules: [outerRule] }], () =>
          elementDirectionStyleOverride(element),
        ),
      ).toBe('ltr');
    } finally {
      window.getComputedStyle = originalWindowGetComputedStyle;
      globalThis.getComputedStyle = originalGlobalGetComputedStyle;
    }
  });

  test('preserves mixed parent-list combinations for multiple nesting references', () => {
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
      const container = document.createElement('section');
      const previous = document.createElement('div');
      previous.className = 'mixed-selector-first';
      const element = document.createElement('div');
      element.className = 'mixed-selector-second';
      container.append(previous, element);
      document.body.appendChild(container);

      const nestedRule = createStyleRule({ selectorText: '& + &', direction: 'ltr' });
      const outerRule = createStyleRule({
        selectorText: '.mixed-selector-first, .mixed-selector-second',
        cssRules: [nestedRule],
      });
      Object.defineProperty(nestedRule, 'parentRule', { configurable: true, value: outerRule });

      expect(
        withDocumentStyleSheets([{ cssRules: [outerRule] }], () =>
          elementDirectionStyleOverride(element),
        ),
      ).toBe('ltr');
    } finally {
      window.getComputedStyle = originalWindowGetComputedStyle;
      globalThis.getComputedStyle = originalGlobalGetComputedStyle;
    }
  });

  test('prefixes implicit nesting in mixed nested selector lists', () => {
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
      const element = document.createElement('div');
      element.className = 'mixed-nested-list-target';
      document.body.appendChild(element);

      const nestedRule = createStyleRule({
        selectorText: '& .mixed-nested-list-child, .mixed-nested-list-target',
        direction: 'ltr',
      });
      const outerRule = createStyleRule({
        selectorText: '.mixed-nested-list-first, .mixed-nested-list-second',
        cssRules: [nestedRule],
      });
      Object.defineProperty(nestedRule, 'parentRule', { configurable: true, value: outerRule });

      expect(
        withDocumentStyleSheets([{ cssRules: [outerRule] }], () =>
          resolveTextDirection(element, 'rtl'),
        ),
      ).toBe('rtl');
    } finally {
      window.getComputedStyle = originalWindowGetComputedStyle;
      globalThis.getComputedStyle = originalGlobalGetComputedStyle;
    }
  });

  test('resolves a native nesting parent selector used mid-selector', () => {
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
      const parent = document.createElement('section');
      parent.className = 'mid-selector-parent';
      const shell = document.createElement('div');
      shell.className = 'mid-selector-shell';
      parent.appendChild(shell);
      document.body.appendChild(parent);

      const nestedRule = createStyleRule({
        selectorText: '.mid-selector-parent:has(&)',
        direction: 'ltr',
      });
      const outerRule = createStyleRule({
        selectorText: '.mid-selector-shell',
        cssRules: [nestedRule],
      });
      Object.defineProperty(nestedRule, 'parentRule', { configurable: true, value: outerRule });

      expect(
        withDocumentStyleSheets([{ cssRules: [outerRule] }], () =>
          resolveTextDirection(parent, 'rtl'),
        ),
      ).toBe('ltr');
    } finally {
      window.getComputedStyle = originalWindowGetComputedStyle;
      globalThis.getComputedStyle = originalGlobalGetComputedStyle;
    }
  });
});
