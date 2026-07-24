/// <reference lib="dom" />

import type { Locator } from '@playwright/test';
import { describe, expect, test } from 'bun:test';

import { waitForFocusStyleFrame } from './focus-ring';

describe('waitForFocusStyleFrame', () => {
  test('settles on exactly the next animation frame', async () => {
    const originalRequestAnimationFrame = globalThis.requestAnimationFrame;
    let frameCallback: FrameRequestCallback | undefined;
    let resolved = false;

    globalThis.requestAnimationFrame = (callback) => {
      frameCallback = callback;
      return 1;
    };

    const target = {
      evaluate: async (callback: () => Promise<void>) => callback(),
    } as unknown as Locator;

    try {
      const result = waitForFocusStyleFrame(target).then(() => {
        resolved = true;
        return undefined;
      });
      await Promise.resolve();
      expect(resolved).toBe(false);
      expect(frameCallback).toBeDefined();

      frameCallback!(0);
      await result;
      expect(resolved).toBe(true);
    } finally {
      globalThis.requestAnimationFrame = originalRequestAnimationFrame;
    }
  });
});
