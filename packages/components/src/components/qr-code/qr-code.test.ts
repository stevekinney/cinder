/// <reference lib="dom" />
import { describe, expect, test } from 'bun:test';
import { join } from 'node:path';

import { setupHappyDom } from '../../test/happy-dom.ts';

// setupHappyDom() MUST run before any `@testing-library/svelte` import. testing-library
// reads `globalThis.document` / `window` at module-init (top-level, not inside test bodies),
// so we register happy-dom's globals first and then dynamic-import testing-library below.
setupHappyDom();

const { render } = await import('@testing-library/svelte');
const { default: QrCode } = await import('./qr-code.svelte');
const qrCodeCssPath = join(import.meta.dir, './qr-code.css');

describe('QrCode', () => {
  test('renders the cinder-qr-code wrapper', () => {
    const { container } = render(QrCode, { props: { value: 'https://example.com' } });
    const element = container.querySelector('.cinder-qr-code');
    expect(element).not.toBeNull();
  });

  test('uses role="img" with fallback accessible name', () => {
    const { container } = render(QrCode, { props: { value: 'https://example.com' } });
    const element = container.querySelector('.cinder-qr-code');
    expect(element?.getAttribute('role')).toBe('img');
    expect(element?.getAttribute('aria-label')).toBe('QR code for https://example.com');
  });

  test('merges a custom class alongside cinder-qr-code', () => {
    const { container } = render(QrCode, {
      props: { value: 'https://example.com', class: 'my-custom-class' },
    });
    const element = container.querySelector('.cinder-qr-code');
    expect(element?.getAttribute('class')).toContain('cinder-qr-code');
    expect(element?.getAttribute('class')).toContain('my-custom-class');
  });

  test('applies square inline and block size styles from size', () => {
    const { container } = render(QrCode, { props: { value: 'hello', size: 192 } });
    const element = container.querySelector('.cinder-qr-code');
    const style = element?.getAttribute('style') ?? '';
    expect(style).toContain('inline-size: 192px');
    expect(style).toContain('block-size: 192px');
  });

  test('qr-code.css uses shared design tokens and no local qr-code variables', async () => {
    const css = await Bun.file(qrCodeCssPath).text();
    expect(css).toContain('var(--cinder-radius-md)');
    expect(css).toContain('var(--cinder-text)');
    expect(css).not.toContain('--cinder-qr-code-');
  });

  test('generated svg uses currentColor fills for themeable rendering', async () => {
    const { container } = render(QrCode, { props: { value: 'https://example.com' } });
    await new Promise((resolve) => setTimeout(resolve, 0));
    const svgMarkup = container.querySelector('.cinder-qr-code svg')?.outerHTML ?? '';
    expect(svgMarkup).toContain('currentColor');
  });
});
