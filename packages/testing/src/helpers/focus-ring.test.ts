/// <reference lib="dom" />

import type { Locator } from '@playwright/test';
import { describe, expect, test } from 'bun:test';

import { waitForFocusStyleFrame } from './focus-ring';

describe('waitForFocusStyleFrame', () => {
  test('settles on exactly the next animation frame', async () => {
    const originalRequestAnimationFrame = globalThis.requestAnimationFrame;
    let frameCallback: FrameRequestCallback | undefined;
    let frameRequests = 0;
    let resolved = false;

    globalThis.requestAnimationFrame = (callback) => {
      frameRequests += 1;
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
      expect(frameRequests).toBe(1);

      frameCallback!(0);
      await result;
      expect(resolved).toBe(true);
      expect(frameRequests).toBe(1);
    } finally {
      globalThis.requestAnimationFrame = originalRequestAnimationFrame;
    }
  });
});
