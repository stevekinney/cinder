/// <reference lib="dom" />
import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { setupHappyDom } from '../../test/happy-dom.ts';
setupHappyDom();
const { fireEvent, render } = await import('@testing-library/svelte');
const { default: ZoomPanViewer } = await import('./zoom-pan-viewer.svelte');
const { createRawSnippet } = await import('svelte');
const textSnippet = (text: string) =>
  createRawSnippet(() => ({ render: () => `<span>${text}</span>` }));
describe('ZoomPanViewer', () => {
  test('standalone sidecar imports Button styles', () => {
    const css = readFileSync(new URL('./zoom-pan-viewer.css', import.meta.url), 'utf8');
    expect(
      css.startsWith(
        '@layer cinder.tokens, cinder.foundation, cinder.components, cinder.utilities;',
      ),
    ).toBe(true);
    expect(css).toContain("@import '../button/button.css';");
  });

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

  test('normalizes a non-finite external scale before rendering', () => {
    const { container } = render(ZoomPanViewer, {
      children: textSnippet('diagram'),
      scale: Number.NaN,
    });
    expect(
      container.querySelector('.cinder-zoom-pan-viewer__viewport')?.getAttribute('style'),
    ).toContain('scale(1)');
  });

  test('does not consume wheel gestures from interactive descendants', async () => {
    const { container } = render(ZoomPanViewer, {
      children: textSnippet('<button type="button">Interactive</button>'),
    });
    const button = container.querySelector('button')!;
    const wheel = new WheelEvent('wheel', { bubbles: true, cancelable: true, deltaY: -100 });
    button.dispatchEvent(wheel);
    expect(wheel.defaultPrevented).toBe(false);
    expect(
      container.querySelector('.cinder-zoom-pan-viewer__viewport')?.getAttribute('style'),
    ).toContain('scale(1)');
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

  test('ignores keyboard shortcuts bubbled from interactive descendants', async () => {
    const { container } = render(ZoomPanViewer, { children: textSnippet('diagram') });
    const viewer = container.querySelector('[role="region"]')!;
    const zoomIn = container.querySelector('[aria-label="Zoom in"]')!;
    const viewport = container.querySelector('.cinder-zoom-pan-viewer__viewport')!;

    await fireEvent.keyDown(zoomIn, { key: '+' });
    expect(viewport.getAttribute('style')).toContain('scale(1)');

    await fireEvent.keyDown(viewer, { key: '+' });
    expect(viewport.getAttribute('style')).toContain('scale(1.2)');
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

  test('cleans up cancelled pointers without dispatching pointerup', async () => {
    let pointerupCount = 0;
    let pointercancelCount = 0;
    const { container } = render(ZoomPanViewer, {
      children: textSnippet('diagram'),
      onpointerup: () => (pointerupCount += 1),
      onpointercancel: () => (pointercancelCount += 1),
    });
    const viewer = container.querySelector('[role="region"]')!;
    const viewport = container.querySelector('.cinder-zoom-pan-viewer__viewport')!;

    await fireEvent.pointerDown(viewer, { pointerId: 1, clientX: 10, clientY: 10 });
    await fireEvent.pointerCancel(viewer, { pointerId: 1, clientX: 10, clientY: 10 });
    await fireEvent.pointerMove(viewer, { pointerId: 1, clientX: 40, clientY: 40 });

    expect(pointerupCount).toBe(0);
    expect(pointercancelCount).toBe(1);
    expect(viewport.getAttribute('style')).toContain('translate(0px, 0px)');
  });

  test('anchors pinch zoom at the gesture midpoint', async () => {
    const { container } = render(ZoomPanViewer, { children: textSnippet('diagram') });
    const viewer = container.querySelector('[role="region"]') as HTMLDivElement;
    const viewport = container.querySelector('.cinder-zoom-pan-viewer__viewport') as HTMLElement;
    viewer.getBoundingClientRect = () => ({
      x: 0,
      y: 0,
      left: 0,
      top: 0,
      right: 100,
      bottom: 100,
      width: 100,
      height: 100,
      toJSON: () => ({}),
    });

    await fireEvent.pointerDown(viewer, { pointerId: 1, clientX: 10, clientY: 10 });
    await fireEvent.pointerDown(viewer, { pointerId: 2, clientX: 30, clientY: 30 });
    await fireEvent.pointerMove(viewer, { pointerId: 1, clientX: 5, clientY: 5 });
    await fireEvent.pointerMove(viewer, { pointerId: 2, clientX: 35, clientY: 35 });

    expect(viewport.getAttribute('style')).not.toContain('translate(0px, 0px)');
    expect(viewport.getAttribute('style')).toContain('scale(1.5)');
  });

  test('resumes one-pointer panning after a pinch pointer is released', async () => {
    const { container } = render(ZoomPanViewer, { children: textSnippet('diagram') });
    const viewer = container.querySelector('[role="region"]') as HTMLDivElement;
    const viewport = container.querySelector('.cinder-zoom-pan-viewer__viewport')!;
    await fireEvent.pointerDown(viewer, { pointerId: 1, clientX: 10, clientY: 10 });
    await fireEvent.pointerDown(viewer, { pointerId: 2, clientX: 30, clientY: 30 });
    await fireEvent.pointerUp(viewer, { pointerId: 2, clientX: 30, clientY: 30 });
    await fireEvent.pointerMove(viewer, { pointerId: 1, clientX: 40, clientY: 10 });
    expect(viewport.getAttribute('style')).toContain('translate(30px, 0px)');
  });
});
