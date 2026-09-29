import { describe, expect, test } from 'bun:test';

import { readCorpusVariables, resolveRegistryPath } from './generate-component-variables.ts';

describe('component variable corpus lookup', () => {
  test('resolves standard and experimental component registries', () => {
    expect(resolveRegistryPath('/workspace/components/cinder/src/components/button')).toBe(
      '/workspace/components/cinder/src/tokens/registry.generated.json',
    );
    expect(
      resolveRegistryPath('/workspace/components/cinder/src/components/experimental/button'),
    ).toBe('/workspace/components/cinder/src/tokens/registry.generated.json');
  });

  test('caches the parsed registry and supports packages without one', async () => {
    const componentDirectory = new URL('../src/components/accordion-item/', import.meta.url)
      .pathname;
    const first = await readCorpusVariables(componentDirectory, 'accordion-item');
    expect(first).toContain('--cinder-accordion-item-trigger-gap');
    const second = await readCorpusVariables(componentDirectory, 'action-row');
    expect(second).toContain('--cinder-action-row-body-gap');
    expect(second).not.toContain('--cinder-accordion-item-trigger-gap');

    const missing = await readCorpusVariables(
      '/workspace/components/chat/src/components/chat',
      'chat',
    );
    expect(missing).toEqual(new Set());
  });
});
