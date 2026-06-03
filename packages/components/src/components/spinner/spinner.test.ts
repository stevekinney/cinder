/// <reference lib="dom" />
import { describe, expect, test } from 'bun:test';
import { join } from 'node:path';

import { setupHappyDom } from '../../test/happy-dom.ts';

// setupHappyDom() MUST run before any `@testing-library/svelte` import. testing-library
// reads `globalThis.document` / `window` at module-init (top-level, not inside test bodies),
// so we register happy-dom's globals first and then dynamic-import testing-library below.
setupHappyDom();

const { render } = await import('@testing-library/svelte');
const { default: Spinner } = await import('./spinner.svelte');
const spinnerCssPath = join(import.meta.dir, './spinner.css');

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

  test('default aria-label is "Loading"', () => {
    const { container } = render(Spinner);
    const spinner = container.querySelector('.cinder-spinner');
    expect(spinner?.getAttribute('aria-label')).toBe('Loading');
  });

  test('sr-only inner span contains the label text', () => {
    const { container } = render(Spinner, { props: { label: 'Fetching data' } });
    const srOnly = container.querySelector('.cinder-spinner__sr-only');
    expect(srOnly?.textContent).toBe('Fetching data');
  });

  test('spinner.css uses the dedicated spin duration token without a fallback literal', async () => {
    const css = await Bun.file(spinnerCssPath).text();

    expect(css).toContain(
      'animation: cinder-spinner-spin var(--cinder-duration-spin) linear infinite;',
    );
    expect(css).not.toContain('--cinder-duration-slow, 1s');
  });

  test('forwards native HTML attributes (id, data-testid) to the root span', () => {
    const { container } = render(Spinner, { props: { id: 'my-spinner', 'data-testid': 'spin' } });
    const spinner = container.querySelector('.cinder-spinner');
    expect(spinner?.getAttribute('id')).toBe('my-spinner');
    expect(spinner?.getAttribute('data-testid')).toBe('spin');
  });

  test('component-controlled role="status" cannot be clobbered by rest spread', () => {
    // Passing role via rest must NOT override the component's own role attr because
    // {...rest} is spread before role="status" in the template.
    const { container } = render(Spinner, { props: { role: 'img' } as never });
    const spinner = container.querySelector('.cinder-spinner');
    expect(spinner?.getAttribute('role')).toBe('status');
  });

  test('component-controlled aria-label cannot be clobbered by rest spread', () => {
    // When the consumer passes aria-label via rest, the component's own aria-label
    // (derived from the `label` prop) wins because it appears after {...rest}.
    const { container } = render(Spinner, {
      props: { label: 'Loading data', 'aria-label': 'should be ignored' } as never,
    });
    const spinner = container.querySelector('.cinder-spinner');
    expect(spinner?.getAttribute('aria-label')).toBe('Loading data');
  });
});
