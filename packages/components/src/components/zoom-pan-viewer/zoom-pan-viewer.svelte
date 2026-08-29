<script lang="ts" module>
  /** @cinder
   * @category data-display
   * @status beta
   * @purpose Interactive viewport for zooming and panning images, diagrams, and rendered Mermaid content.
   * @tag zoom-pan-viewer
   * @useWhen Viewing large images or SVG diagrams that need pointer and keyboard navigation.
   * @avoidWhen Showing ordinary responsive media that does not need a viewport transform.
   * @related image, button
   */
  export type { ZoomPanViewerProps } from './zoom-pan-viewer.types.ts';
</script>

<script lang="ts">
  import Button from '../button/button.svelte';
  import Plus from 'lucide-svelte/icons/plus';
  import Minus from 'lucide-svelte/icons/minus';
  import RotateCcw from 'lucide-svelte/icons/rotate-ccw';
  import { classNames } from '../../utilities/class-names.ts';
  import type { ZoomPanViewerProps } from './zoom-pan-viewer.types.ts';
  let {
    class: customClassName,
    children,
    scale = $bindable(1),
    onTransformChange,
    ariaLabel = 'Zoomable viewer',
    onkeydown: consumerOnkeydown,
    onwheel: consumerOnwheel,
    onpointerdown: consumerOnpointerdown,
    onpointermove: consumerOnpointermove,
    onpointerup: consumerOnpointerup,
    onpointercancel: consumerOnpointercancel,
    ...rest
  }: ZoomPanViewerProps = $props();
  let x = $state(0);
  let y = $state(0);
  let dragging = false;
  let startX = 0;
  let startY = 0;
  let originX = 0;
  let originY = 0;
  const pointers = new Map<number, { x: number; y: number }>();
  let pinchDistance = 0;
  const clampScale = (value: number) => Math.min(8, Math.max(0.25, value));
  const normalizedScale = $derived(clampScale(scale));
  function update(nextScale: number, nextX = x, nextY = y) {
    scale = clampScale(nextScale);
    x = nextX;
    y = nextY;
    onTransformChange?.({ scale, x, y });
  }
  function zoomAt(factor: number, anchor?: { x: number; y: number }) {
    const px = anchor?.x ?? 0;
    const py = anchor?.y ?? 0;
    const next = clampScale(normalizedScale * factor);
    const ratio = next / normalizedScale;
    update(next, px - (px - x) * ratio, py - (py - y) * ratio);
  }
  function keydown(event: KeyboardEvent & { currentTarget: HTMLDivElement }) {
    if (event.target !== event.currentTarget) {
      consumerOnkeydown?.(event);
      return;
    }
    if (event.key === '+' || event.key === '=') {
      event.preventDefault();
      zoomAt(1.2);
    } else if (event.key === '-' || event.key === '_') {
      event.preventDefault();
      zoomAt(1 / 1.2);
    } else if (event.key === '0') {
      event.preventDefault();
      update(1, 0, 0);
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      panBy(-32, 0);
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      panBy(32, 0);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      panBy(0, -32);
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      panBy(0, 32);
    }
    consumerOnkeydown?.(event);
  }
  function panBy(deltaX: number, deltaY: number) {
    update(normalizedScale, x + deltaX, y + deltaY);
  }
  function isInteractiveTarget(target: EventTarget | null): boolean {
    return (
      target instanceof Element &&
      !!target.closest(
        'button, a, input, textarea, select, [contenteditable="true"], [role="button"], [role="link"]',
      )
    );
  }
  function pointerdown(event: PointerEvent & { currentTarget: HTMLDivElement }) {
    if (isInteractiveTarget(event.target)) {
      consumerOnpointerdown?.(event);
      return;
    }
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointers.size === 1) {
      dragging = true;
      startX = event.clientX;
      startY = event.clientY;
      originX = x;
      originY = y;
    } else if (pointers.size === 2) {
      const values = [...pointers.values()];
      const first = values[0];
      const second = values[1];
      if (first && second) pinchDistance = Math.hypot(first.x - second.x, first.y - second.y);
      dragging = false;
    }
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    consumerOnpointerdown?.(event);
  }
  function pointermove(event: PointerEvent & { currentTarget: HTMLDivElement }) {
    if (!pointers.has(event.pointerId)) {
      consumerOnpointermove?.(event);
      return;
    }
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointers.size >= 2) {
      const values = [...pointers.values()];
      const first = values[0];
      const second = values[1];
      if (!first || !second) {
        consumerOnpointermove?.(event);
        return;
      }
      const distance = Math.hypot(first.x - second.x, first.y - second.y);
      if (pinchDistance) {
        const rect = event.currentTarget.getBoundingClientRect();
        zoomAt(distance / pinchDistance, {
          x: (first.x + second.x) / 2 - rect.left - rect.width / 2,
          y: (first.y + second.y) / 2 - rect.top - rect.height / 2,
        });
      }
      pinchDistance = distance;
    } else if (dragging)
      update(normalizedScale, originX + event.clientX - startX, originY + event.clientY - startY);
    consumerOnpointermove?.(event);
  }
  function cleanupPointer(event: PointerEvent & { currentTarget: HTMLDivElement }) {
    pointers.delete(event.pointerId);
    pinchDistance = 0;
    const remaining = pointers.values().next().value as { x: number; y: number } | undefined;
    if (remaining) {
      dragging = true;
      startX = remaining.x;
      startY = remaining.y;
      originX = x;
      originY = y;
    } else {
      dragging = false;
    }
  }
  function pointerup(event: PointerEvent & { currentTarget: HTMLDivElement }) {
    cleanupPointer(event);
    consumerOnpointerup?.(event);
  }
  function pointercancel(event: PointerEvent & { currentTarget: HTMLDivElement }) {
    cleanupPointer(event);
    consumerOnpointercancel?.(event);
  }
</script>

<!-- svelte-ignore a11y_no_noninteractive_tabindex: the region is keyboard-focusable for zoom and pan controls. -->
<div
  class={classNames('cinder-zoom-pan-viewer', customClassName)}
  role="region"
  aria-label={ariaLabel}
  tabindex="0"
  onkeydown={keydown}
  onwheel={(event) => {
    event.preventDefault();
    const rect = event.currentTarget.getBoundingClientRect();
    zoomAt(event.deltaY < 0 ? 1.1 : 1 / 1.1, {
      x: event.clientX - rect.left - rect.width / 2,
      y: event.clientY - rect.top - rect.height / 2,
    });
    consumerOnwheel?.(event);
  }}
  onpointerdown={pointerdown}
  onpointermove={pointermove}
  onpointerup={pointerup}
  onpointercancel={pointercancel}
  {...rest}
>
  <div
    class="cinder-zoom-pan-viewer__viewport"
    style={`transform: translate(${x}px, ${y}px) scale(${normalizedScale})`}
  >
    {@render children()}
  </div>
  <div class="cinder-zoom-pan-viewer__controls" aria-label="Zoom controls">
    <Button size="sm" variant="secondary" iconOnly aria-label="Zoom in" onclick={() => zoomAt(1.2)}
      ><Plus /></Button
    ><Button
      size="sm"
      variant="secondary"
      iconOnly
      aria-label="Reset zoom"
      onclick={() => update(1, 0, 0)}><RotateCcw /></Button
    ><Button
      size="sm"
      variant="secondary"
      iconOnly
      aria-label="Zoom out"
      onclick={() => zoomAt(1 / 1.2)}><Minus /></Button
    >
  </div>
</div>
