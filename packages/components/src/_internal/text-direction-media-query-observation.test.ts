import { describe, expect, test } from 'bun:test';

import {
  createCssRule,
  createMediaList,
  createMediaQueryList,
  createStyleSheetWithRuleCollection,
  createStyleSheetWithRules,
  withDocumentAdoptedStyleSheets,
  withDocumentStyleSheets,
} from './text-direction-test-helpers.ts';
import { observeTextDirectionMediaQueries } from './text-direction.ts';

describe('resolveTextDirection', () => {
  test('observes media queries in document-adopted stylesheets', () => {
    const originalMatchMedia = globalThis.matchMedia;
    const listeners = new Set<EventListener>();
    const mediaSheet = new CSSStyleSheet();
    mediaSheet.insertRule('@media (prefers-color-scheme: dark) {}');
    globalThis.matchMedia = (query: string) => createMediaQueryList(query, false, listeners);
    const element = document.createElement('div');
    document.body.append(element);
    let changes = 0;

    try {
      const disconnect = withDocumentStyleSheets([], () =>
        withDocumentAdoptedStyleSheets([mediaSheet], () =>
          observeTextDirectionMediaQueries(element, () => {
            changes += 1;
          }),
        ),
      );
      expect(listeners.size).toBe(1);
      for (const listener of listeners) listener(new Event('change'));
      expect(changes).toBe(1);
      disconnect?.();
      expect(listeners.size).toBe(0);
    } finally {
      globalThis.matchMedia = originalMatchMedia;
    }
  });

  test('observes media queries in recursively imported stylesheets', () => {
    const originalMatchMedia = globalThis.matchMedia;
    const listeners = new Set<EventListener>();
    let activeListenerCount = 0;
    const queries: string[] = [];
    const importedMediaRule = createCssRule({
      cssText: '@media (prefers-color-scheme: dark) {}',
      type: 4,
      conditionText: '(prefers-color-scheme: dark)',
      cssRules: [],
    });
    const importedRuleList = {
      [Symbol.iterator]: function* () {
        yield importedMediaRule;
      },
    };
    const importedSheet = createStyleSheetWithRuleCollection(importedRuleList);
    const importRule = createCssRule({
      type: 3,
      cssText: '@import url("theme.css") screen and (prefers-color-scheme: dark);',
      media: createMediaList('screen and (prefers-color-scheme: dark)'),
      styleSheet: importedSheet,
    });
    globalThis.matchMedia = (query: string) =>
      createMediaQueryList(
        query,
        false,
        listeners,
        () => {
          activeListenerCount += 1;
        },
        () => {
          activeListenerCount -= 1;
        },
      );
    const originalMatchMediaWithTracking = globalThis.matchMedia;
    globalThis.matchMedia = (query: string) => {
      queries.push(query);
      return originalMatchMediaWithTracking(query);
    };
    const element = document.createElement('div');
    document.body.append(element);
    let changes = 0;

    try {
      const disconnect = withDocumentStyleSheets([{ cssRules: [importRule] }], () =>
        observeTextDirectionMediaQueries(element, () => {
          changes += 1;
        }),
      );
      expect(new Set(queries)).toEqual(
        new Set(['screen and (prefers-color-scheme: dark)', '(prefers-color-scheme: dark)']),
      );
      expect(activeListenerCount).toBe(2);
      for (const listener of listeners) listener(new Event('change'));
      expect(changes).toBeGreaterThan(0);
      disconnect?.();
      expect(activeListenerCount).toBe(0);
    } finally {
      globalThis.matchMedia = originalMatchMedia;
    }
  });

  test('deduplicates shared and cyclic imports while observing import media', () => {
    const originalMatchMedia = globalThis.matchMedia;
    const listeners = new Set<EventListener>();
    let activeListenerCount = 0;
    const queries: string[] = [];
    const sharedMediaRule = createCssRule({
      cssText: '@media (prefers-contrast: more) {}',
      type: 4,
      conditionText: '(prefers-contrast: more)',
      cssRules: [],
    });
    const rootSheet = createStyleSheetWithRules([]);
    const importedSheet = createStyleSheetWithRules([]);
    const sharedSheet = createStyleSheetWithRules([sharedMediaRule]);
    const rootImport = createCssRule({
      type: 3,
      cssText: '@import url("nested.css") screen;',
      media: createMediaList('screen'),
      styleSheet: rootSheet,
    });
    const duplicateSharedImport = createCssRule({
      type: 3,
      cssText: '@import url("shared.css") screen;',
      media: createMediaList('screen'),
      styleSheet: sharedSheet,
    });
    const cycleImport = createCssRule({
      type: 3,
      cssText: '@import url("root.css");',
      media: createMediaList(''),
      styleSheet: rootSheet,
    });
    const sharedImport = createCssRule({
      type: 3,
      cssText: '@import url("shared.css") screen;',
      media: createMediaList('screen'),
      styleSheet: sharedSheet,
    });
    Object.defineProperty(rootSheet, 'cssRules', {
      configurable: true,
      value: [rootImport, duplicateSharedImport],
    });
    Object.defineProperty(importedSheet, 'cssRules', {
      configurable: true,
      value: [cycleImport, sharedImport],
    });
    globalThis.matchMedia = (query: string) => {
      queries.push(query);
      return createMediaQueryList(
        query,
        false,
        listeners,
        () => {
          activeListenerCount += 1;
        },
        () => {
          activeListenerCount -= 1;
        },
      );
    };
    const element = document.createElement('div');
    document.body.append(element);

    try {
      const disconnect = withDocumentStyleSheets([{ cssRules: rootSheet.cssRules }], () =>
        observeTextDirectionMediaQueries(element, () => {}),
      );
      expect(new Set(queries)).toEqual(new Set(['screen', '(prefers-contrast: more)']));
      expect(activeListenerCount).toBe(2);
      disconnect?.();
      expect(activeListenerCount).toBe(0);
    } finally {
      globalThis.matchMedia = originalMatchMedia;
    }
  });
});
