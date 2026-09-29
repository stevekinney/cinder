/// <reference lib="dom" />
import { afterEach, describe, expect, test } from 'bun:test';

import { setupHappyDom } from '@lostgradient/testing';

setupHappyDom();

const { cleanup, render } = await import('@testing-library/svelte');
const { default: PhoneInput } = await import('./phone-input.svelte');

afterEach(cleanup);

function nationalInput(container: Element): HTMLInputElement {
  return container.querySelector<HTMLInputElement>('input[type="tel"]')!;
}

function countrySelect(container: Element): HTMLSelectElement {
  return container.querySelector<HTMLSelectElement>('select')!;
}

describe('PhoneInput keyboard tab order', () => {
  test('country select precedes the national input in DOM order', () => {
    const { container } = render(PhoneInput, {
      props: { id: 'p', label: 'Phone' },
    });
    const select = countrySelect(container);
    const input = nationalInput(container);
    // DOCUMENT_POSITION_FOLLOWING (4) means select comes before input.
    expect(select.compareDocumentPosition(input) & Node.DOCUMENT_POSITION_FOLLOWING).toBe(4);
  });

  test('neither control has a tabindex override', () => {
    const { container } = render(PhoneInput, {
      props: { id: 'p', label: 'Phone' },
    });
    expect(countrySelect(container).getAttribute('tabindex')).toBeNull();
    expect(nationalInput(container).getAttribute('tabindex')).toBeNull();
  });
});
