import { describe, expect, test } from 'bun:test';

import { readCorpusVariables, resolveRegistryPath } from './generate-component-variables.ts';

describe('component variable corpus lookup', () => {
  test('resolves standard and experimental component registries', () => {
    expect(resolveRegistryPath('/workspace/packages/components/src/components/button')).toBe(
      '/workspace/packages/components/src/tokens/registry.generated.json',
    );
    expect(
      resolveRegistryPath('/workspace/packages/components/src/components/experimental/button'),
    ).toBe('/workspace/packages/components/src/tokens/registry.generated.json');
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
      '/workspace/packages/chat/src/components/chat',
      'chat',
    );
    expect(missing).toEqual(new Set());
  });
});
