/// <reference lib="dom" />
import { afterEach, describe, expect, test } from 'bun:test';

import { setupHappyDom } from '../../test/happy-dom.ts';

setupHappyDom();

const { cleanup, render } = await import('@testing-library/svelte');
const { default: LocaleProviderFixture } =
  await import('../../test/fixtures/locale-provider-fixture.svelte');

afterEach(() => {
  cleanup();
  document.body.replaceChildren();
});

describe('LocaleProvider', () => {
  test('provides a default locale to locale-aware descendants', () => {
    const { container } = render(LocaleProviderFixture, {
      props: { locale: 'de-DE' },
    });

    expect(container.querySelector('.cinder-stat__value')?.textContent).toBe('1.234,5');
    expect(container.querySelector<HTMLInputElement>('#localized-number')?.value).toBe('1.234,5');
    expect(container.querySelector('select')?.textContent).toContain('Vereinigte Staaten +1');
  });

  test('explicit locale props override the provider locale', () => {
    const { container } = render(LocaleProviderFixture, {
      props: {
        locale: 'de-DE',
        explicitStatLocale: 'en-US',
        explicitNumberLocale: 'en-US',
        explicitPhoneLocale: 'en-US',
      },
    });

    expect(container.querySelector('.cinder-stat__value')?.textContent).toBe('1,234.5');
    expect(container.querySelector<HTMLInputElement>('#localized-number')?.value).toBe('1,234.5');
    expect(container.querySelector('select')?.textContent).toContain('United States +1');
  });
});
