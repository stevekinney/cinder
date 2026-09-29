import { describe, expect, test } from 'bun:test';

import { withComputedDirection } from './text-direction-test-helpers.ts';
import { resolveTextDirection } from './text-direction.ts';

describe('resolveTextDirection', () => {
  test('prefers provider fallback over document root direction', () => {
    document.documentElement.dir = 'ltr';
    const element = document.createElement('div');
    document.body.appendChild(element);

    expect(resolveTextDirection(element, 'rtl')).toBe('rtl');
  });

  test('prefers provider fallback over root CSS direction', () => {
    const styleElement = document.createElement('style');
    styleElement.textContent = 'html { direction: ltr; }';
    document.head.append(styleElement);
    const element = document.createElement('div');
    document.body.appendChild(element);

    expect(resolveTextDirection(element, 'rtl')).toBe('rtl');
    styleElement.remove();
  });

  test('uses document root direction when no local or provider direction exists', () => {
    document.documentElement.dir = 'rtl';
    const element = document.createElement('div');
    document.body.appendChild(element);

    expect(resolveTextDirection(element)).toBe('rtl');
  });

  test('uses computed direction for local auto direction before parent fallback', () => {
    const originalWindowGetComputedStyle = window.getComputedStyle;
    const originalGlobalGetComputedStyle = globalThis.getComputedStyle;
    const getComputedStyleOverride = ((target: Element) => {
      let style = originalWindowGetComputedStyle(target);
      if (target instanceof HTMLElement && target.dir === 'auto') {
        style = withComputedDirection(style, 'rtl');
      }
      return style;
    }) as typeof window.getComputedStyle;
    window.getComputedStyle = getComputedStyleOverride;
    globalThis.getComputedStyle = getComputedStyleOverride;

    try {
      const wrapper = document.createElement('div');
      wrapper.dir = 'ltr';
      const element = document.createElement('div');
      element.dir = 'auto';
      wrapper.appendChild(element);
      document.body.appendChild(wrapper);

      expect(resolveTextDirection(element)).toBe('rtl');
    } finally {
      window.getComputedStyle = originalWindowGetComputedStyle;
      globalThis.getComputedStyle = originalGlobalGetComputedStyle;
    }
  });

  test('uses computed direction from an auto ancestor before provider fallback', () => {
    const originalWindowGetComputedStyle = window.getComputedStyle;
    const originalGlobalGetComputedStyle = globalThis.getComputedStyle;
    const getComputedStyleOverride = ((target: Element) => {
      let style = originalWindowGetComputedStyle(target);
      if (target instanceof HTMLElement && target.dir === 'auto') {
        style = withComputedDirection(style, 'ltr');
      }
      return style;
    }) as typeof window.getComputedStyle;
    window.getComputedStyle = getComputedStyleOverride;
    globalThis.getComputedStyle = getComputedStyleOverride;

    try {
      const wrapper = document.createElement('div');
      wrapper.dir = 'auto';
      const element = document.createElement('div');
      wrapper.appendChild(element);
      document.body.appendChild(wrapper);

      expect(resolveTextDirection(element, 'rtl')).toBe('ltr');
    } finally {
      window.getComputedStyle = originalWindowGetComputedStyle;
      globalThis.getComputedStyle = originalGlobalGetComputedStyle;
    }
  });

  test('uses computed direction before provider fallback', () => {
    const wrapper = document.createElement('section');
    wrapper.style.direction = 'ltr';
    const element = document.createElement('div');
    wrapper.appendChild(element);
    document.body.appendChild(wrapper);

    expect(resolveTextDirection(element, 'rtl')).toBe('ltr');
  });

  test('uses inherited CSS direction before provider fallback', () => {
    const originalWindowGetComputedStyle = window.getComputedStyle;
    const originalGlobalGetComputedStyle = globalThis.getComputedStyle;
    const getComputedStyleOverride = ((target: Element) => {
      let style = originalWindowGetComputedStyle(target);
      const direction =
        target === document.documentElement
          ? 'ltr'
          : target instanceof HTMLElement && target.closest('.css-direction')
            ? 'rtl'
            : style.direction;
      style = withComputedDirection(style, direction);
      return style;
    }) as typeof window.getComputedStyle;
    window.getComputedStyle = getComputedStyleOverride;
    globalThis.getComputedStyle = getComputedStyleOverride;

    try {
      const wrapper = document.createElement('section');
      wrapper.className = 'css-direction';
      const element = document.createElement('div');
      wrapper.appendChild(element);
      document.body.appendChild(wrapper);

      expect(resolveTextDirection(element, 'ltr')).toBe('rtl');
    } finally {
      window.getComputedStyle = originalWindowGetComputedStyle;
      globalThis.getComputedStyle = originalGlobalGetComputedStyle;
    }
  });

  test('uses class-applied computed direction before provider fallback', () => {
    const originalWindowGetComputedStyle = window.getComputedStyle;
    const originalGlobalGetComputedStyle = globalThis.getComputedStyle;
    const styleElement = document.createElement('style');
    styleElement.textContent = '.ltr-reset { direction: ltr; }';
    document.head.appendChild(styleElement);
    const getComputedStyleOverride = ((target: Element) => {
      let style = originalWindowGetComputedStyle(target);
      style = withComputedDirection(style, 'ltr');
      return style;
    }) as typeof window.getComputedStyle;
    window.getComputedStyle = getComputedStyleOverride;
    globalThis.getComputedStyle = getComputedStyleOverride;

    try {
      const wrapper = document.createElement('section');
      wrapper.className = 'ltr-reset';
      const element = document.createElement('div');
      wrapper.appendChild(element);
      document.body.appendChild(wrapper);

      expect(resolveTextDirection(element, 'rtl')).toBe('ltr');
    } finally {
      window.getComputedStyle = originalWindowGetComputedStyle;
      globalThis.getComputedStyle = originalGlobalGetComputedStyle;
      styleElement.remove();
    }
  });

  test('uses grouped CSS direction rules before provider fallback', () => {
    const originalWindowGetComputedStyle = window.getComputedStyle;
    const originalGlobalGetComputedStyle = globalThis.getComputedStyle;
    const styleElement = document.createElement('style');
    styleElement.textContent = '@media all { .ltr-reset-grouped { direction: ltr; } }';
    document.head.appendChild(styleElement);
    const getComputedStyleOverride = ((target: Element) => {
      let style = originalWindowGetComputedStyle(target);
      style = withComputedDirection(style, 'ltr');
      return style;
    }) as typeof window.getComputedStyle;
    window.getComputedStyle = getComputedStyleOverride;
    globalThis.getComputedStyle = getComputedStyleOverride;

    try {
      const wrapper = document.createElement('section');
      wrapper.className = 'ltr-reset-grouped';
      const element = document.createElement('div');
      wrapper.appendChild(element);
      document.body.appendChild(wrapper);

      expect(resolveTextDirection(element, 'rtl')).toBe('ltr');
    } finally {
      window.getComputedStyle = originalWindowGetComputedStyle;
      globalThis.getComputedStyle = originalGlobalGetComputedStyle;
      styleElement.remove();
    }
  });
});
