/// <reference lib="dom" />
import { describe, expect, test } from 'bun:test';

import { setupHappyDom } from '../test/happy-dom.ts';

// setupHappyDom() MUST run before any `@testing-library/svelte` import. testing-library
// reads `globalThis.document` / `window` at module-init (top-level, not inside test bodies),
// so we register happy-dom's globals first and then dynamic-import testing-library below.
setupHappyDom();

const { render } = await import('@testing-library/svelte');
const { default: Spinner } = await import('./spinner.svelte');

describe('Spinner', () => {
  test('renders without errors', () => {
    const { container } = render(Spinner);
    expect(container.querySelector('.cinder-spinner')).not.toBeNull();
  });

  test('has role="status"', () => {
    const { container } = render(Spinner);
    const spinner = container.querySelector('.cinder-spinner');
    expect(spinner?.getAttribute('role')).toBe('status');
  });

  test('has aria-label attribute', () => {
    const { container } = render(Spinner);
    const spinner = container.querySelector('.cinder-spinner');
    expect(spinner?.hasAttribute('aria-label')).toBe(true);
  });

  test('every size renders data-cinder-size attribute', () => {
    for (const size of ['sm', 'md', 'lg'] as const) {
      const { container } = render(Spinner, { props: { size } });
      const spinner = container.querySelector('.cinder-spinner');
      expect(spinner?.getAttribute('data-cinder-size')).toBe(size);
    }
  });

  test('applies class prop alongside cinder-spinner', () => {
    const { container } = render(Spinner, { props: { class: 'my-extra-class' } });
    const classAttr = container.querySelector('.cinder-spinner')?.getAttribute('class') ?? '';
    expect(classAttr).toContain('cinder-spinner');
    expect(classAttr).toContain('my-extra-class');
  });

  test('custom label is reflected in aria-label', () => {
    const { container } = render(Spinner, { props: { label: 'Please wait' } });
    const spinner = container.querySelector('.cinder-spinner');
    expect(spinner?.getAttribute('aria-label')).toBe('Please wait');
  });

  test('default aria-label is "Loading..."', () => {
    const { container } = render(Spinner);
    const spinner = container.querySelector('.cinder-spinner');
    expect(spinner?.getAttribute('aria-label')).toBe('Loading...');
  });

  test('sr-only inner span contains the label text', () => {
    const { container } = render(Spinner, { props: { label: 'Fetching data' } });
    const srOnly = container.querySelector('.cinder-spinner__sr-only');
    expect(srOnly?.textContent).toBe('Fetching data');
  });
});
