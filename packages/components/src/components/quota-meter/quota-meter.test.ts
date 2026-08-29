/// <reference lib="dom" />
import { describe, expect, test } from 'bun:test';

import { setupHappyDom } from '../../test/happy-dom.ts';

// setupHappyDom() MUST run before any `@testing-library/svelte` import. testing-library
// reads `globalThis.document` / `window` at module-init (top-level, not inside test bodies),
// so we register happy-dom's globals first and then dynamic-import testing-library below.
setupHappyDom();

const { render } = await import('@testing-library/svelte');
const { default: QuotaMeter } = await import('./quota-meter.svelte');
// createRawSnippet must be imported dynamically so Bun's svelte plugin (which patches
// the svelte package to resolve to the client build) applies before this import resolves.
// A top-level static import of 'svelte' resolves to svelte/index-server.js in Bun's
// non-browser environment, making `mount()` throw "not available on the server".
const { createRawSnippet } = await import('svelte');

/** Creates a Svelte 5 Snippet that renders text content. */
function textSnippet(text: string) {
  return createRawSnippet(() => ({
    render: () => `<span>${text}</span>`,
  }));
}

describe('QuotaMeter', () => {
  test('renders the cinder-quota-meter wrapper with its children', () => {
    const { container } = render(QuotaMeter, {
      used: 2,
      limit: 10,
      children: textSnippet('content'),
    });
    const element = container.querySelector('.cinder-quota-meter');
    expect(element).not.toBeNull();
    expect(element?.textContent).toContain('content');
  });

  test('merges a custom class alongside cinder-quota-meter', () => {
    const { container } = render(QuotaMeter, {
      children: textSnippet('content'),
      used: 2,
      limit: 10,
      class: 'my-custom-class',
    });
    const element = container.querySelector('.cinder-quota-meter');
    expect(element?.getAttribute('class')).toContain('cinder-quota-meter');
    expect(element?.getAttribute('class')).toContain('my-custom-class');
  });

  test('composes quota-specific accessible value text', () => {
    const { container } = render(QuotaMeter, {
      used: 24,
      limit: 100,
      resetsAt: '2026-09-01T00:00:00Z',
      locale: 'en-US',
      timeZone: 'UTC',
    });
    const meter = container.querySelector('[role="meter"]');
    expect(meter?.getAttribute('aria-valuetext')).toContain('24 of 100 used');
    expect(meter?.getAttribute('aria-valuetext')).toContain('resets Sep 1, 2026');
  });

  test('uses the browser locale after mount when formatting a reset date', () => {
    const originalLanguage = navigator.language;
    Object.defineProperty(navigator, 'language', { configurable: true, value: 'de-DE' });
    try {
      const { container } = render(QuotaMeter, {
        used: 24,
        resetsAt: '2026-09-01T00:00:00Z',
        timeZone: 'UTC',
      });
      expect(container.querySelector('[role="meter"]')?.getAttribute('aria-valuetext')).toContain(
        '01.09.2026',
      );
    } finally {
      Object.defineProperty(navigator, 'language', {
        configurable: true,
        value: originalLanguage,
      });
    }
  });

  test('announces unlimited quotas without inventing a finite limit', () => {
    const { container } = render(QuotaMeter, { used: 24, unlimited: true });
    expect(container.querySelector('[role="status"]')?.getAttribute('aria-label')).toContain(
      '24 used, unlimited',
    );
    expect(container.querySelector('[role="meter"]')).toBeNull();
  });

  test.each([0, -10])('uses Meter fallback wording for an invalid limit (%s)', (limit) => {
    const { container } = render(QuotaMeter, { used: 24, limit });
    expect(container.querySelector('[role="meter"]')?.getAttribute('aria-valuetext')).toBe(
      '24 of 100 used',
    );
  });

  test('ignores an invalid reset date instead of throwing during render', () => {
    const { container } = render(QuotaMeter, { used: 24, resetsAt: 'not-a-date' });
    expect(container.querySelector('[role="meter"]')?.getAttribute('aria-valuetext')).toBe(
      '24 of 100 used',
    );
  });

  test.each([Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])(
    'normalizes a non-finite used value (%s) for Meter and accessible text',
    (used) => {
      const { container } = render(QuotaMeter, { used });
      const meter = container.querySelector('[role="meter"]');
      expect(meter?.getAttribute('aria-valuenow')).toBe('0');
      expect(meter?.getAttribute('aria-valuetext')).toBe('0 of 100 used');
    },
  );

  test('formats the Unix epoch when resetsAt is zero', () => {
    const { container } = render(QuotaMeter, {
      used: 24,
      resetsAt: 0,
      locale: 'en-US',
      timeZone: 'UTC',
    });
    expect(container.querySelector('[role="meter"]')?.getAttribute('aria-valuetext')).toContain(
      'resets Jan 1, 1970',
    );
  });

  test('documents required props in component usage examples', async () => {
    const [quotaReadme, codeLocationReadme, citationReadme] = await Promise.all([
      Bun.file(new URL('../quota-meter/README.md', import.meta.url)).text(),
      Bun.file(new URL('../code-location/README.md', import.meta.url)).text(),
      Bun.file(new URL('../citation/README.md', import.meta.url)).text(),
    ]);
    expect(quotaReadme).toContain('<QuotaMeter used={72} />');
    expect(codeLocationReadme).toContain('<CodeLocation file=');
    expect(citationReadme).toContain('<Citation sources=');
  });
});
