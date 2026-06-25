/// <reference lib="dom" />
import { afterEach, describe, expect, test } from 'bun:test';

import { setupHappyDom } from '../test/happy-dom.ts';
import { observeTextDirection, resolveTextDirection } from './text-direction.ts';

setupHappyDom();

afterEach(() => {
  document.documentElement.removeAttribute('dir');
  document.body.replaceChildren();
});

describe('resolveTextDirection', () => {
  test('prefers local DOM direction over provider fallback', () => {
    const wrapper = document.createElement('div');
    wrapper.dir = 'ltr';
    const element = document.createElement('div');
    wrapper.appendChild(element);
    document.body.appendChild(wrapper);

    expect(resolveTextDirection(element, 'rtl')).toBe('ltr');
  });

  test('prefers provider fallback over document root direction', () => {
    document.documentElement.dir = 'ltr';
    const element = document.createElement('div');
    document.body.appendChild(element);

    expect(resolveTextDirection(element, 'rtl')).toBe('rtl');
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
      const style = originalWindowGetComputedStyle(target);
      if (target instanceof HTMLElement && target.dir === 'auto') {
        Object.defineProperty(style, 'direction', { value: 'rtl', configurable: true });
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
      const style = originalWindowGetComputedStyle(target);
      if (target instanceof HTMLElement && target.dir === 'auto') {
        Object.defineProperty(style, 'direction', { value: 'ltr', configurable: true });
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
      const style = originalWindowGetComputedStyle(target);
      const direction =
        target === document.documentElement
          ? 'ltr'
          : target instanceof HTMLElement && target.closest('.css-direction')
            ? 'rtl'
            : style.direction;
      Object.defineProperty(style, 'direction', { value: direction, configurable: true });
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
      const style = originalWindowGetComputedStyle(target);
      Object.defineProperty(style, 'direction', { value: 'ltr', configurable: true });
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
      const style = originalWindowGetComputedStyle(target);
      Object.defineProperty(style, 'direction', { value: 'ltr', configurable: true });
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

  test('ignores grouped CSS direction rules inside inactive media conditions', () => {
    const originalWindowGetComputedStyle = window.getComputedStyle;
    const originalGlobalGetComputedStyle = globalThis.getComputedStyle;
    const originalMatchMedia = globalThis.matchMedia;
    const styleElement = document.createElement('style');
    styleElement.textContent =
      '@media (min-width: 99999px) { .inactive-ltr-reset { direction: ltr; } }';
    document.head.appendChild(styleElement);
    const getComputedStyleOverride = ((target: Element) => {
      const style = originalWindowGetComputedStyle(target);
      Object.defineProperty(style, 'direction', { value: 'ltr', configurable: true });
      return style;
    }) as typeof window.getComputedStyle;
    const matchMediaOverride = ((query: string) =>
      ({
        matches: false,
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => true,
      }) satisfies MediaQueryList) as typeof globalThis.matchMedia;
    window.getComputedStyle = getComputedStyleOverride;
    globalThis.getComputedStyle = getComputedStyleOverride;
    globalThis.matchMedia = matchMediaOverride;

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
      const style = originalWindowGetComputedStyle(target);
      Object.defineProperty(style, 'direction', { value: 'ltr', configurable: true });
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

  test('observes text mutations under auto direction sources', async () => {
    const wrapper = document.createElement('section');
    wrapper.dir = 'auto';
    wrapper.textContent = 'Schedule';
    const element = document.createElement('div');
    wrapper.appendChild(element);
    document.body.appendChild(wrapper);

    let changes = 0;
    const disconnect = observeTextDirection(element, () => {
      changes += 1;
    });

    wrapper.firstChild!.textContent = 'جدول';
    await new Promise((resolve) => setTimeout(resolve, 0));
    disconnect?.();

    expect(changes).toBeGreaterThan(0);
  });
});
