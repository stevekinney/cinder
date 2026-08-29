/// <reference lib="dom" />
import { describe, expect, test } from 'bun:test';
import { setupHappyDom } from '../../test/happy-dom.ts';
setupHappyDom();
const { fireEvent, render } = await import('@testing-library/svelte');
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

  test('uses region semantics, clamps external scale, and pans with arrow keys', async () => {
    const onTransformChange = () => {};
    const { container } = render(ZoomPanViewer, {
      children: textSnippet('diagram'),
      scale: 100,
      onTransformChange,
    });
    const viewer = container.querySelector('[role="region"]') as HTMLElement;
    expect(viewer).not.toBeNull();
    expect(
      container.querySelector('.cinder-zoom-pan-viewer__viewport')?.getAttribute('style'),
    ).toContain('scale(8)');
    await fireEvent.keyDown(viewer, { key: 'ArrowRight' });
    expect(
      container.querySelector('.cinder-zoom-pan-viewer__viewport')?.getAttribute('style'),
    ).toContain('translate(32px');
  });

  test('preserves consumer event handlers while handling keyboard controls', async () => {
    let received = false;
    const { container } = render(ZoomPanViewer, {
      children: textSnippet('diagram'),
      onkeydown: () => (received = true),
    });
    await fireEvent.keyDown(container.querySelector('[role="region"]')!, { key: '+' });
    expect(received).toBe(true);
  });

  test('does not capture pointer gestures from interactive descendants', async () => {
    const { container } = render(ZoomPanViewer, {
      children: textSnippet('<button type="button">Interactive</button>'),
    });
    const button = container.querySelector('button')!;
    await fireEvent.pointerDown(button, { pointerId: 1, clientX: 10, clientY: 10 });
    expect(
      container.querySelector('.cinder-zoom-pan-viewer__viewport')?.getAttribute('style'),
    ).toContain('translate(0px');
  });
});
