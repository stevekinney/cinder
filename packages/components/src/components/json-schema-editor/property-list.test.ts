/// <reference lib="dom" />
import { afterEach, describe, expect, test } from 'bun:test';

import { setupHappyDom } from '../../test/happy-dom.ts';

setupHappyDom();

const { cleanup, fireEvent, render } = await import('@testing-library/svelte');
const { default: PropertyList } = await import('./property-list.svelte');
const { calculatePropertyValidationErrorCount } = await import('./property-list-validation.ts');

// @testing-library/svelte v5's auto-cleanup does not register under bun:test (no
// global afterEach), so unmount the rendered list after each test. Without this
// the mounted list leaks into the shared happy-dom document.body and sibling
// files (e.g. json-schema-editor.test.ts) see duplicate elements.
afterEach(() => cleanup());

describe('PropertyList', () => {
  test('composes Collapsible for required names and avoids schema jargon', async () => {
    const source = await Bun.file(new URL('./property-list.svelte', import.meta.url)).text();

    expect(source).toContain("import Collapsible from '@lostgradient/cinder/collapsible'");
    expect(source).not.toContain("from '../collapsible/collapsible.svelte'");
    expect(source).toContain('Required fields not yet defined');
    expect(source).not.toContain('<details class="cinder-jse-required-only"');
    expect(source).not.toContain('Required without property schema');
  });

  test('uses a rotating Lucide chevron for property disclosure', async () => {
    const { container } = render(PropertyList, {
      idPrefix: 'properties',
      path: '/properties',
      properties: { name: { type: 'string' } },
      required: [],
      onValueChange: () => {},
    });

    const trigger = container.querySelector<HTMLButtonElement>(
      '[aria-label="Expand name property"]',
    );
    const chevron = trigger?.querySelector('.cinder-jse-property-row__chevron');
    expect(chevron?.tagName.toLowerCase()).toBe('svg');
    expect(trigger?.textContent).not.toContain('▸');
    expect(trigger?.getAttribute('aria-expanded')).toBe('false');

    const css = await Bun.file(new URL('./json-schema-editor.css', import.meta.url)).text();
    expect(css).toMatch(
      /\.cinder-jse-property-row__trigger\[aria-expanded='true'\]\s*>\s*\.cinder-jse-property-row__chevron\s*\{[^}]*transform:\s*rotate\(180deg\)/,
    );
    expect(css).toContain('background: var(--cinder-surface-raised-hover);');
  });

  test('can add the first required-only property name', async () => {
    let latestRequired: string[] = [];
    const { container } = render(PropertyList, {
      idPrefix: 'properties',
      path: '/properties',
      properties: {},
      required: [],
      onValueChange: (_properties: unknown, required: string[]) => {
        latestRequired = required;
      },
    });

    const input = container.querySelector('#properties-required-only-add') as HTMLInputElement;
    const addButton = Array.from(container.querySelectorAll('button')).find(
      (button) => button.textContent?.trim() === 'Add required name',
    );

    expect(input).not.toBeNull();
    expect(addButton).not.toBeUndefined();

    await fireEvent.input(input, { target: { value: 'missingSchema' } });
    await fireEvent.click(addButton!);

    expect(latestRequired).toEqual(['missingSchema']);
  });

  test('aggregates local and nested validation error counts', async () => {
    expect(
      calculatePropertyValidationErrorCount(
        ['first', 'nested'],
        {
          first: 1,
          nested: 2,
          deleted: 4,
        },
        true,
      ),
    ).toBe(4);
  });

  test('renders a danger indicator on the row with nested validation errors', async () => {
    const source = await Bun.file(new URL('./property-list.svelte', import.meta.url)).text();

    expect(source).toContain("import Badge from '../badge/badge.svelte'");
    expect(source).toContain('data-cinder-invalid={childValidationErrorCount > 0');
    expect(source).toContain('<Badge\n              variant="danger"');
    expect(source).toContain('validation ${childValidationErrorCount');
  });

  test('property-list.svelte clears nested validation counts on collapse and unmount', async () => {
    const source = await Bun.file(new URL('./property-list.svelte', import.meta.url)).text();

    expect(source).toContain('onDestroy(() =>');
    expect(source).toContain('onvalidationErrorcount?.(0)');
    expect(source).toContain('function toggleExpanded');
    expect(source).toContain('if (isOpen) setChildValidationErrorCount(key, 0)');
  });
});
