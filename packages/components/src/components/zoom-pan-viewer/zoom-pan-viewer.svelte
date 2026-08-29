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
  function update(nextScale: number, nextX = x, nextY = y) {
    scale = Math.min(8, Math.max(0.25, nextScale));
    x = nextX;
    y = nextY;
    onTransformChange?.({ scale, x, y });
  }
  function zoomAt(factor: number, event?: WheelEvent) {
    const node = event?.currentTarget as HTMLElement | undefined;
    const rect = node?.getBoundingClientRect();
    const px = rect && event ? event.clientX - rect.left - rect.width / 2 : 0;
    const py = rect && event ? event.clientY - rect.top - rect.height / 2 : 0;
    const next = Math.min(8, Math.max(0.25, scale * factor));
    const ratio = next / scale;
    update(next, px - (px - x) * ratio, py - (py - y) * ratio);
  }
  function keydown(event: KeyboardEvent) {
    if (event.key === '+' || event.key === '=') {
      event.preventDefault();
      zoomAt(1.2);
    } else if (event.key === '-' || event.key === '_') {
      event.preventDefault();
      zoomAt(1 / 1.2);
    } else if (event.key === '0') {
      event.preventDefault();
      update(1, 0, 0);
    }
  }
  function pointerdown(event: PointerEvent) {
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointers.size === 1) {
      dragging = true;
      startX = event.clientX;
      startY = event.clientY;
      originX = x;
      originY = y;
    } else if (pointers.size === 2) {
      const values = [...pointers.values()];
      pinchDistance = Math.hypot(values[0].x - values[1].x, values[0].y - values[1].y);
      dragging = false;
    }
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  }
  function pointermove(event: PointerEvent) {
    if (!pointers.has(event.pointerId)) return;
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointers.size >= 2) {
      const values = [...pointers.values()];
      const distance = Math.hypot(values[0].x - values[1].x, values[0].y - values[1].y);
      if (pinchDistance) zoomAt(distance / pinchDistance);
      pinchDistance = distance;
    } else if (dragging)
      update(scale, originX + event.clientX - startX, originY + event.clientY - startY);
  }
  function pointerup(event: PointerEvent) {
    pointers.delete(event.pointerId);
    pinchDistance = 0;
    dragging = false;
  }
</script>

<div
  class={classNames('cinder-zoom-pan-viewer', customClassName)}
  role="button"
  aria-label={ariaLabel}
  tabindex="0"
  onkeydown={keydown}
  onwheel={(event) => {
    event.preventDefault();
    zoomAt(event.deltaY < 0 ? 1.1 : 1 / 1.1, event);
  }}
  onpointerdown={pointerdown}
  onpointermove={pointermove}
  onpointerup={pointerup}
  onpointercancel={pointerup}
  {...rest}
>
  <div
    class="cinder-zoom-pan-viewer__viewport"
    style={`transform: translate(${x}px, ${y}px) scale(${scale})`}
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
