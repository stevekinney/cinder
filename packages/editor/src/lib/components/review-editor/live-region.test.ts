/// <reference lib="dom" />
import { describe, expect, test } from 'bun:test';
import { mount, tick, unmount } from 'svelte';

import { expectNoLeakedTimers, setupHappyDom, trackTimers } from '@lostgradient/testing';

setupHappyDom();

// Dynamic import so the Svelte component loads after happy-dom is installed.
const { default: LiveRegion } = await import('./live-region.svelte');

// ---------------------------------------------------------------------------
// Timer-leak regression: LiveRegion.announce() schedules a 1000ms clearTimeout.
//
// live-region.svelte schedules `clearTimeoutId = setTimeout(() => { message = '' }, 1000)`
// via a queueMicrotask inside announce(). The $effect cleanup sets isDestroyed = true and
// calls clearTimeout(clearTimeoutId). This test triggers the timer path, then unmounts
// synchronously (before the 1000ms fires) to verify the timer is cleared and does not leak.
// ---------------------------------------------------------------------------

describe('LiveRegion', () => {
  test('mounts and renders an aria live region', () => {
    const target = document.createElement('div');
    document.body.appendChild(target);
    try {
      const instance = mount(LiveRegion, { target });
      expect(target.querySelector('[role="status"]')).not.toBeNull();
      unmount(instance);
    } finally {
      target.remove();
    }
  });

  test('announces the malformed front-matter recovery sentence politely', async () => {
    const target = document.createElement('div');
    document.body.appendChild(target);
    try {
      const instance = mount(LiveRegion, { target });

      instance.announce('Front matter could not be parsed; showing as plain text.', 'polite');
      await Promise.resolve();
      await tick();

      const region = target.querySelector('[aria-live="polite"]');
      expect(region?.textContent).toBe('Front matter could not be parsed; showing as plain text.');
      expect(target.querySelector('[role="alert"]')).toBeNull();

      unmount(instance);
    } finally {
      target.remove();
    }
  });

  test('unmounting after announce() leaves no pending clear-message timer', async () => {
    // announce() calls queueMicrotask, then inside the microtask schedules
    // clearTimeoutId = setTimeout(..., 1000). The $effect cleanup runs
    // clearTimeout(clearTimeoutId) when the component is destroyed, so the
    // 1000ms timer must NOT be pending after unmount.
    const target = document.createElement('div');
    document.body.appendChild(target);
    const timers = trackTimers();
    try {
      const instance = mount(LiveRegion, { target });

      // Call the exported announce() function to schedule the 1000ms timer.
      // The timer is set inside queueMicrotask, so await a microtask boundary
      // before unmounting to ensure it is actually pending at unmount time.
      instance.announce('Comment added', 'polite');

      // Let the queueMicrotask callback run so the 1000ms setTimeout is scheduled.
      await Promise.resolve();

      // Unmount synchronously before the 1000ms fires. The $effect cleanup must
      // call clearTimeout(clearTimeoutId) and prevent the timer from leaking.
      unmount(instance);

      expectNoLeakedTimers(timers.active());
    } finally {
      timers.release();
      target.remove();
    }
  });
});
