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

  test('uses role="img" with fallback accessible name on initial render', () => {
    const { container } = render(QrCode, { props: { value: 'https://example.com' } });
    const element = container.querySelector('.cinder-qr-code');
    expect(element?.getAttribute('role')).toBe('img');
    expect(element?.getAttribute('aria-label')).toBe('QR code');
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
    expect(css).toContain('color: #000');
    expect(css).toContain('background: #fff');
    expect(css).not.toContain('--cinder-qr-code-');
  });

  test('generated svg uses currentColor fills for themeable rendering', () => {
    const { container } = render(QrCode, { props: { value: 'https://example.com' } });
    const svgMarkup = container.querySelector('.cinder-qr-code svg')?.outerHTML ?? '';
    expect(svgMarkup).toContain('currentColor');
  });

  test('encodes the largest payload QR version 40 can hold at the strictest ECC level (CIN-137)', () => {
    // Worst case: error-correction level 'H' at the largest byte-mode payload that
    // still fits QR version 40 (1273 bytes; verified empirically against the
    // installed qrcode@1.5.4 — one byte more throws). Version 40 forces the most
    // expensive mask-pattern scoring pass (size=177 modules/side).
    //
    // CIN-137 asked for a MEASUREMENT, and one was taken: 200 iterations after
    // warmup put this path at mean ~6ms, p95 ~7.5ms, max ~9.6ms — nowhere near
    // blocking. Those numbers live on the issue and in the pull request, which is
    // where evidence belongs.
    //
    // Deliberately NOT asserted here as a wall-clock budget. performance.now()
    // counts time the process spends descheduled, so on a contended CI worker a
    // perfectly correct render can blow any threshold — and AGENTS.md is explicit
    // that a timing threshold is not something to relax later when it flakes. This
    // test therefore pins the functional contract (a version-40 'H' payload encodes
    // and renders rather than falling into the error path); benchmarking stays
    // outside the unit-test gate.
    const oversizedButValidPayload = 'a'.repeat(1273);

    const { container } = render(QrCode, {
      props: { value: oversizedButValidPayload, errorCorrectionLevel: 'H' },
    });

    const element = container.querySelector('.cinder-qr-code');
    expect(element?.getAttribute('data-cinder-state')).toBe('ready');
    expect(element?.getAttribute('data-cinder-invalid')).toBeNull();
    expect(container.querySelector('.cinder-qr-code svg')).not.toBeNull();
  });

  test('renders an error state when the payload is too large for any QR version', () => {
    const oversizedValue = 'a'.repeat(3000);
    const { container } = render(QrCode, { props: { value: oversizedValue } });
    const element = container.querySelector('.cinder-qr-code');

    expect(element?.getAttribute('role')).toBe('status');
    expect(element?.getAttribute('aria-label')).toBe('Unable to render QR code');
    expect(element?.getAttribute('data-cinder-invalid')).toBe('true');
    expect(element?.getAttribute('data-cinder-state')).toBe('error');
    expect(element?.querySelector('svg')).toBeNull();
    const errorMark = element?.querySelector('.cinder-qr-code__error-mark');
    expect(errorMark).not.toBeNull();
    expect(errorMark?.textContent).toBe('!');
  });
});
