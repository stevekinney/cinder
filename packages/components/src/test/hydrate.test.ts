/// <reference lib="dom" />
/**
 * Smoke test for the SSR-render-and-hydrate helper.
 *
 * Uses Input as the reference fixture: it generates ARIA wiring through
 * derived IDs, has a label association, and exercises Shape B prop spreading —
 * a representative SSR target. If hydrate works for Input, it works for
 * the Phase 1 form controls too.
 */

import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, test } from 'bun:test';

import { setupHappyDom } from './happy-dom.ts';

setupHappyDom();

const { renderThenHydrate, __tempFileRegistryForTests } = await import('./hydrate.ts');
const { default: Input } = await import('../components/input/input.svelte');

const INPUT_SOURCE = join(import.meta.dir, '..', 'components', 'input', 'input.svelte');

describe('renderThenHydrate', () => {
  test('renders Input on the server and hydrates without warnings', async () => {
    const result = await renderThenHydrate(Input, INPUT_SOURCE, {
      id: 'hydrate-input',
      value: '',
      label: 'Hydrate test',
    });

    try {
      expect(result.ssrHtml).toContain('cinder-input');
      expect(result.ssrHtml).toContain('hydrate-input');
      expect(result.ssrHtml).toContain('Hydrate test');

      const input = result.container.querySelector('#hydrate-input');
      expect(input).not.toBeNull();

      const mismatchWarnings = result.warnings.filter((w) => w.toLowerCase().includes('hydration'));
      expect(mismatchWarnings).toEqual([]);
    } finally {
      result.cleanup();
    }
  });

  test('description and error elements survive hydration with their IDs', async () => {
    const result = await renderThenHydrate(Input, INPUT_SOURCE, {
      id: 'hydrate-aria',
      value: '',
      description: 'Helper text',
      error: 'Validation message',
    });

    try {
      const input = result.container.querySelector('#hydrate-aria');
      const describedBy = input?.getAttribute('aria-describedby') ?? '';
      expect(describedBy).toContain('hydrate-aria-description');
      expect(describedBy).toContain('hydrate-aria-error');

      expect(result.container.querySelector('#hydrate-aria-description')).not.toBeNull();
      expect(result.container.querySelector('#hydrate-aria-error')).not.toBeNull();
    } finally {
      result.cleanup();
    }
  });

  test('exit-handler safety net unlinks temp files when cleanup() is skipped', async () => {
    // Deliberately do NOT call result.cleanup() — simulate a test that throws
    // or a process interruption before per-test cleanup runs.
    const result = await renderThenHydrate(Input, INPUT_SOURCE, {
      id: 'hydrate-orphan',
      value: '',
      label: 'Orphan',
    });

    // The temp SSR module is on disk and registered for exit cleanup.
    const registered = [...__tempFileRegistryForTests.paths];
    expect(registered.length).toBeGreaterThan(0);
    expect(registered.every((path) => existsSync(path))).toBe(true);

    // Run exactly what the process-exit handler runs.
    __tempFileRegistryForTests.runExitCleanup();

    // Every registered temp file is gone and the registry is drained.
    expect(registered.every((path) => existsSync(path))).toBe(false);
    expect(__tempFileRegistryForTests.paths.size).toBe(0);

    // The safety net is proven. Now run the real cleanup() to unmount the
    // component instance (not just remove the container) so its effects and
    // listeners don't leak into later tests. The temp file is already gone, so
    // cleanup()'s own unlink is a harmless no-op.
    result.cleanup();
  });

  test('keeps temp files registered when synchronous removal fails', () => {
    const path = join(import.meta.dir, '.cinder-ssr-removal-failure.mjs');
    __tempFileRegistryForTests.registerPath(path);

    __tempFileRegistryForTests.removePath(path, () => {
      throw Object.assign(new Error('permission denied'), { code: 'EACCES' });
    });

    expect(__tempFileRegistryForTests.paths.has(path)).toBe(true);

    __tempFileRegistryForTests.removePath(path, () => {
      throw Object.assign(new Error('already removed'), { code: 'ENOENT' });
    });
    expect(__tempFileRegistryForTests.paths.has(path)).toBe(false);
  });
});
