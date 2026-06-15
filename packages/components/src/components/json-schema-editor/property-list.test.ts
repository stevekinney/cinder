/// <reference lib="dom" />
import { afterEach, describe, expect, test } from 'bun:test';

import { setupHappyDom } from '../../test/happy-dom.ts';

setupHappyDom();

const { cleanup, fireEvent, render } = await import('@testing-library/svelte');
const { default: PropertyList } = await import('./property-list.svelte');

// @testing-library/svelte v5's auto-cleanup does not register under bun:test (no
// global afterEach), so unmount the rendered list after each test. Without this
// the mounted list leaks into the shared happy-dom document.body and sibling
// files (e.g. json-schema-editor.test.ts) see duplicate elements.
afterEach(() => cleanup());

describe('PropertyList', () => {
  test('can add the first required-only property name', async () => {
    let latestRequired: string[] = [];
    const { container } = render(PropertyList, {
      idPrefix: 'properties',
      path: '/properties',
      properties: {},
      required: [],
      onchange: (_properties: unknown, required: string[]) => {
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
});
