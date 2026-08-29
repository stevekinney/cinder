/// <reference lib="dom" />
import { describe, expect, test } from 'bun:test';
import { setupHappyDom } from '../../test/happy-dom.ts';
setupHappyDom();
const { render } = await import('@testing-library/svelte');
const { default: ZoomPanViewer } = await import('./zoom-pan-viewer.svelte');
const { createRawSnippet } = await import('svelte');
const textSnippet = (text: string) =>
  createRawSnippet(() => ({ render: () => `<span>${text}</span>` }));
describe('ZoomPanViewer', () => {
  test('renders content and named controls', () => {
    const { container } = render(ZoomPanViewer, { children: textSnippet('diagram') });
    expect(container.textContent).toContain('diagram');
    expect(container.querySelector('[aria-label="Zoom in"]')).not.toBeNull();
    expect(container.querySelector('[aria-label="Reset zoom"]')).not.toBeNull();
    expect(container.querySelector('[aria-label="Zoom out"]')).not.toBeNull();
  });
});
