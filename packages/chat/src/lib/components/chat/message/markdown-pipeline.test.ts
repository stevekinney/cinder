import { afterEach, describe, expect, test } from 'bun:test';

import { preloadMarkdownPipeline } from './markdown-pipeline.ts';

const originalWindowDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'window');

afterEach(() => {
  if (originalWindowDescriptor) {
    Object.defineProperty(globalThis, 'window', originalWindowDescriptor);
  } else {
    Reflect.deleteProperty(globalThis, 'window');
  }
});

function installBrowserRealm(): void {
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: globalThis,
  });
}

describe('markdown pipeline preloader', () => {
  test('does not load the browser-only graph outside a browser realm', () => {
    Reflect.deleteProperty(globalThis, 'window');
    let loadCount = 0;
    const loadPipeline = async () => {
      loadCount += 1;
      return { renderMarkdownWithMath: async () => ({ html: '' }) };
    };

    expect(preloadMarkdownPipeline(loadPipeline)).toBeUndefined();
    expect(loadCount).toBe(0);
  });

  test('retries a rejected load and caches the successful result', async () => {
    installBrowserRealm();
    let loadCount = 0;
    const pipeline = { renderMarkdownWithMath: async () => ({ html: '<p>ready</p>' }) };
    const loadPipeline = async () => {
      loadCount += 1;
      if (loadCount === 1) throw new Error('chunk unavailable');
      return pipeline;
    };

    expect(await preloadMarkdownPipeline(loadPipeline)).toBeUndefined();
    const second = preloadMarkdownPipeline(loadPipeline);
    const third = preloadMarkdownPipeline(loadPipeline);
    expect(second).toBe(third);
    const loadedPipeline = await second;
    expect(loadedPipeline?.renderMarkdownWithMath).toBe(pipeline.renderMarkdownWithMath);
    expect(loadCount).toBe(2);
  });
});
