/// <reference lib="dom" />
import { afterEach, describe, expect, test } from 'bun:test';
import { createRawSnippet } from 'svelte';

import { setupHappyDom } from '../../test/happy-dom.ts';

setupHappyDom();

const { cleanup, render } = await import('@testing-library/svelte');
const { default: PreviewPanel } = await import('./preview-panel.svelte');

afterEach(cleanup);

function textSnippet(text: string) {
  return createRawSnippet(() => ({
    render: () => `<span>${text}</span>`,
  }));
}

describe('PreviewPanel', () => {
  test('renders layout regions without assigning application semantics', () => {
    const { container } = render(PreviewPanel, {
      props: {
        title: 'Run preview',
        status: 'ready',
        leading: textSnippet('Icon'),
        actions: textSnippet('Open'),
        tabs: textSnippet('Summary'),
        footer: textSnippet('Updated now'),
        children: textSnippet('Preview body'),
      },
    });

    const panel = container.querySelector('.cinder-preview-panel');
    expect(panel).not.toBeNull();
    expect(panel?.getAttribute('data-cinder-status')).toBe('ready');
    expect(panel?.querySelector('.cinder-preview-panel__title')?.textContent).toBe('Run preview');
    expect(panel?.querySelector('.cinder-preview-panel__leading')?.textContent).toContain('Icon');
    expect(panel?.querySelector('.cinder-preview-panel__actions')?.textContent).toContain('Open');
    expect(panel?.querySelector('.cinder-preview-panel__tabs')?.textContent).toContain('Summary');
    expect(panel?.querySelector('.cinder-preview-panel__body')?.textContent).toContain(
      'Preview body',
    );
    expect(panel?.querySelector('.cinder-preview-panel__footer')?.textContent).toContain(
      'Updated now',
    );
  });

  test('error status uses alert semantics and other statuses stay non-live', () => {
    const error = render(PreviewPanel, {
      props: {
        title: 'Run preview',
        status: 'error',
        children: textSnippet('Preview body'),
      },
    });

    expect(error.container.querySelector('.cinder-preview-panel')?.getAttribute('role')).toBe(
      'alert',
    );
    error.unmount();

    const ready = render(PreviewPanel, {
      props: {
        title: 'Run preview',
        status: 'ready',
        children: textSnippet('Preview body'),
      },
    });

    expect(ready.container.querySelector('.cinder-preview-panel')?.hasAttribute('role')).toBe(
      false,
    );
  });

  test('css preserves nested overflow by setting min-height zero on body and panel', async () => {
    const css = await Bun.file(new URL('./preview-panel.css', import.meta.url)).text();

    expect(css).toMatch(/\.cinder-preview-panel\s*\{[^}]*min-height:\s*0/s);
    expect(css).toMatch(/\.cinder-preview-panel__body\s*\{[^}]*min-height:\s*0/s);
    expect(css).toMatch(/\.cinder-preview-panel__body\s*\{[^}]*overflow:\s*auto/s);
  });
});
