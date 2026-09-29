import { describe, expect, test } from 'bun:test';

import { createMediaQueryList, withComputedDirection } from './text-direction-test-helpers.ts';
import { resolveTextDirection } from './text-direction.ts';

const activeMatchMedia = (query: string) => createMediaQueryList(query, true);
const inactiveMatchMedia = (query: string) => createMediaQueryList(query, false);

describe('resolveTextDirection', () => {
  test('uses grouped CSS direction rules inside active media conditions', () => {
    const originalWindowGetComputedStyle = window.getComputedStyle;
    const originalGlobalGetComputedStyle = globalThis.getComputedStyle;
    const originalMatchMedia = globalThis.matchMedia;
    const styleElement = document.createElement('style');
    styleElement.textContent = '@media (min-width: 1px) { .active-ltr-reset { direction: ltr; } }';
    document.head.appendChild(styleElement);
    const getComputedStyleOverride = ((target: Element) => {
      let style = originalWindowGetComputedStyle(target);
      style = withComputedDirection(style, 'ltr');
      return style;
    }) as typeof window.getComputedStyle;
    window.getComputedStyle = getComputedStyleOverride;
    globalThis.getComputedStyle = getComputedStyleOverride;
    globalThis.matchMedia = activeMatchMedia;

    try {
      const wrapper = document.createElement('section');
      wrapper.className = 'active-ltr-reset';
      const element = document.createElement('div');
      wrapper.appendChild(element);
      document.body.appendChild(wrapper);

      expect(resolveTextDirection(element, 'rtl')).toBe('ltr');
    } finally {
      window.getComputedStyle = originalWindowGetComputedStyle;
      globalThis.getComputedStyle = originalGlobalGetComputedStyle;
      globalThis.matchMedia = originalMatchMedia;
      styleElement.remove();
    }
  });

  test('uses grouped CSS direction rules inside active supports conditions', () => {
    const originalWindowGetComputedStyle = window.getComputedStyle;
    const originalGlobalGetComputedStyle = globalThis.getComputedStyle;
    const originalCssSupports = globalThis.CSS.supports;
    const styleElement = document.createElement('style');
    styleElement.textContent =
      '@supports (display: grid) { .supports-ltr-reset { direction: ltr; } }';
    document.head.appendChild(styleElement);
    const getComputedStyleOverride = ((target: Element) => {
      let style = originalWindowGetComputedStyle(target);
      style = withComputedDirection(style, 'ltr');
      return style;
    }) as typeof window.getComputedStyle;
    globalThis.CSS.supports = () => true;
    window.getComputedStyle = getComputedStyleOverride;
    globalThis.getComputedStyle = getComputedStyleOverride;

    try {
      const wrapper = document.createElement('section');
      wrapper.className = 'supports-ltr-reset';
      const element = document.createElement('div');
      wrapper.appendChild(element);
      document.body.appendChild(wrapper);

      expect(resolveTextDirection(element, 'rtl')).toBe('ltr');
    } finally {
      window.getComputedStyle = originalWindowGetComputedStyle;
      globalThis.getComputedStyle = originalGlobalGetComputedStyle;
      globalThis.CSS.supports = originalCssSupports;
      styleElement.remove();
    }
  });

  test('ignores grouped CSS direction rules inside inactive media conditions', () => {
    const originalWindowGetComputedStyle = window.getComputedStyle;
    const originalGlobalGetComputedStyle = globalThis.getComputedStyle;
    const originalMatchMedia = globalThis.matchMedia;
    const styleElement = document.createElement('style');
    styleElement.textContent =
      '@media (min-width: 99999px) { .inactive-ltr-reset { direction: ltr; } }';
    document.head.appendChild(styleElement);
    const getComputedStyleOverride = ((target: Element) => {
      let style = originalWindowGetComputedStyle(target);
      style = withComputedDirection(style, 'ltr');
      return style;
    }) as typeof window.getComputedStyle;
    window.getComputedStyle = getComputedStyleOverride;
    globalThis.getComputedStyle = getComputedStyleOverride;
    globalThis.matchMedia = inactiveMatchMedia;

    try {
      const wrapper = document.createElement('section');
      wrapper.className = 'inactive-ltr-reset';
      const element = document.createElement('div');
      wrapper.appendChild(element);
      document.body.appendChild(wrapper);

      expect(resolveTextDirection(element, 'rtl')).toBe('rtl');
    } finally {
      window.getComputedStyle = originalWindowGetComputedStyle;
      globalThis.getComputedStyle = originalGlobalGetComputedStyle;
      globalThis.matchMedia = originalMatchMedia;
      styleElement.remove();
    }
  });
  test('uses provider fallback before unrelated app classes with default computed direction', () => {
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
      const wrapper = document.createElement('section');
      wrapper.className = 'app-shell';
      const element = document.createElement('div');
      wrapper.appendChild(element);
      document.body.appendChild(wrapper);

      expect(resolveTextDirection(element, 'rtl')).toBe('rtl');
    } finally {
      window.getComputedStyle = originalWindowGetComputedStyle;
      globalThis.getComputedStyle = originalGlobalGetComputedStyle;
    }
  });

  test('prefers nearer inline style direction over farther dir ancestor', () => {
    const outer = document.createElement('div');
    outer.dir = 'rtl';
    const wrapper = document.createElement('section');
    wrapper.style.direction = 'ltr';
    const element = document.createElement('div');
    wrapper.appendChild(element);
    outer.appendChild(wrapper);
    document.body.appendChild(outer);

    expect(resolveTextDirection(element)).toBe('ltr');
  });

  test('prefers a non-literal ancestor inline direction over a provider fallback', () => {
    const originalWindowGetComputedStyle = window.getComputedStyle;
    const originalGlobalGetComputedStyle = globalThis.getComputedStyle;
    const wrapper = document.createElement('section');
    wrapper.style.direction = 'var(--flow)';
    const element = document.createElement('div');
    element.dir = 'rtl';
    wrapper.append(element);
    document.body.append(wrapper);
    const getComputedStyleOverride = ((target: Element) => {
      let style = originalWindowGetComputedStyle(target);
      if (target === wrapper) style = withComputedDirection(style, 'ltr');
      return style;
    }) as typeof window.getComputedStyle;
    window.getComputedStyle = getComputedStyleOverride;
    globalThis.getComputedStyle = getComputedStyleOverride;

    try {
      expect(resolveTextDirection(element, 'rtl', { ignoreElementDirectionAttribute: true })).toBe(
        'ltr',
      );
    } finally {
      window.getComputedStyle = originalWindowGetComputedStyle;
      globalThis.getComputedStyle = originalGlobalGetComputedStyle;
    }
  });
});
