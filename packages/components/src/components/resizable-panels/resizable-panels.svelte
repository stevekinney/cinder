<script lang="ts" module>
  /**
   * @cinder
   * @category layout
   * @status beta
   * @purpose Measured splitter layout that renders adjacent resize handles between panes and emits persisted layout state after pointer, keyboard, and collapse interactions.
   * @tag layout
   * @tag splitter
   * @tag panels
   * @useWhen Building editor, inspector, or dashboard layouts where neighboring panes must be resized directly by dragging a separator.
   * @useWhen Persisting a multi-pane workspace layout without coupling the component to localStorage.
   * @avoidWhen You only need a static two-column or stack layout with no interactive resizing.
   * @avoidWhen Content should wrap naturally instead of claiming a fixed share of a measured container.
   * @related divider
   * @related page-layout
   * @related scroll-area
   */
  export type {
    ResizablePanelDefinition,
    ResizablePanelRenderContext,
    ResizablePanelSize,
    ResizablePanelSizeState,
    ResizablePanelsCollapseTarget,
    ResizablePanelsOrientation,
    ResizablePanelsProps,
    ResizablePanelsResizeEvent,
    ResizablePanelsResizeReason,
  } from './resizable-panels.types.ts';
</script>

<script lang="ts">
  import { BROWSER as browser } from 'esm-env';

  import { classNames } from '../../utilities/class-names.ts';
  import {
    applyPairDelta,
    applyPairSnap,
    createInitialLayoutState,
    getHandleAriaState,
    getLayoutSnapshot,
    rebaseLayoutState,
    resolveKeyboardStep,
    setLeadingPanePixels,
    toggleCollapseForHandle,
    validatePanes,
  } from './resizable-panels-sizing.ts';
  import type {
    ResizablePanelRenderContext,
    ResizablePanelSize,
    ResizablePanelsProps,
    ResizablePanelsResizeEvent,
    ResizablePanelsResizeReason,
  } from './resizable-panels.types.ts';
  import type { ResizablePanelsLayoutState } from './resizable-panels-sizing.ts';

  let {
    panes,
    orientation = 'horizontal',
    keyboardStep,
    snapThreshold = { value: 8, unit: 'px' },
    collapseOnDoubleClick = false,
    collapseTarget = 'nearest-collapsible',
    onlayoutchange,
    onlayoutcommit,
    children,
    class: className,
    ...rest
  }: ResizablePanelsProps = $props();

  const componentId = $props.id();
  let rootElement: HTMLDivElement | undefined = $state();
  let measuredRootPixels = $state(0);
  let measuredHandlePixels = $state(8);
  let activeHandleIndex = $state<number | null>(null);
  let activePointerId = $state<number | null>(null);
  let pointerStartAxis = $state(0);
  let dragState: ResizablePanelsLayoutState | null = $state(null);
  let layoutState: ResizablePanelsLayoutState | null = $state(null);

  const issues = $derived(validatePanes(panes));

  function computeAvailablePanePixels(
    rootPixels = measuredRootPixels,
    handlePixels = measuredHandlePixels,
  ): number {
    return Math.max(0, rootPixels - Math.max(0, panes.length - 1) * handlePixels);
  }

  const availablePanePixels = $derived.by(() => computeAvailablePanePixels());

  const unmeasuredSizes = $derived(
    panes.map((pane, index) => {
      const percent = panes.length > 0 ? 100 / panes.length : 0;
      const size: ResizablePanelSize = { value: percent, unit: 'percent' };
      const context: ResizablePanelRenderContext = {
        id: pane.id,
        index,
        collapsed: false,
        size,
        pixelSize: 0,
        percentage: percent,
      };
      return context;
    }),
  );

  function emit(reason: ResizablePanelsResizeReason, committed: boolean): void {
    if (!layoutState) return;
    const detail: ResizablePanelsResizeEvent = {
      reason,
      orientation,
      sizes: getLayoutSnapshot(layoutState, panes),
    };
    onlayoutchange?.(detail);
    if (committed) {
      onlayoutcommit?.(detail);
    }
  }

  function syncMeasuredLayout(nextAvailablePanePixels = availablePanePixels): void {
    if (nextAvailablePanePixels <= 0 || panes.length === 0) return;
    if (!layoutState) {
      layoutState = createInitialLayoutState(panes, nextAvailablePanePixels, orientation);
      return;
    }
    if (
      layoutState.availablePanePixels !== nextAvailablePanePixels ||
      layoutState.orientation !== orientation
    ) {
      layoutState = rebaseLayoutState(layoutState, panes, nextAvailablePanePixels, orientation);
      return;
    }
    if (
      layoutState.panels.length !== panes.length ||
      layoutState.panels.some((panel, index) => panel.id !== panes[index]?.id)
    ) {
      layoutState = rebaseLayoutState(layoutState, panes, nextAvailablePanePixels, orientation);
    }
  }

  function measureRoot(): void {
    if (!rootElement) return;
    const rect = rootElement.getBoundingClientRect();
    const rootPixels = orientation === 'horizontal' ? rect.width : rect.height;
    const firstHandle = rootElement.querySelector<HTMLElement>('.cinder-resizable-panels__handle');
    let handlePixels = measuredHandlePixels;
    if (firstHandle) {
      const handleRect = firstHandle.getBoundingClientRect();
      handlePixels = orientation === 'horizontal' ? handleRect.width : handleRect.height;
    }
    measuredRootPixels = rootPixels;
    measuredHandlePixels = handlePixels;
    syncMeasuredLayout(computeAvailablePanePixels(rootPixels, handlePixels));
  }

  $effect(() => {
    if (!browser || !rootElement) return;
    measureRoot();
    const resizeObserver = new ResizeObserver(() => {
      measureRoot();
    });
    resizeObserver.observe(rootElement);
    return () => resizeObserver.disconnect();
  });

  $effect(() => {
    if (!browser) return;
    availablePanePixels;
    orientation;
    panes;
    syncMeasuredLayout();
  });

  $effect(() => {
    if (!issues.length || typeof console === 'undefined') return;
    for (const issue of issues) {
      console.warn(`[cinder/ResizablePanels] ${issue}`);
    }
  });

  function axisValueFromPointerEvent(event: PointerEvent): number {
    return orientation === 'horizontal' ? event.clientX : event.clientY;
  }

  function handlePointerDown(event: PointerEvent, handleIndex: number): void {
    if (!layoutState) return;
    activeHandleIndex = handleIndex;
    activePointerId = event.pointerId;
    pointerStartAxis = axisValueFromPointerEvent(event);
    dragState = layoutState;
    if (event.currentTarget instanceof HTMLElement) {
      event.currentTarget.focus();
      if ('setPointerCapture' in event.currentTarget) {
        event.currentTarget.setPointerCapture(event.pointerId);
      }
    }
  }

  function handlePointerMove(event: PointerEvent): void {
    if (activeHandleIndex === null || activePointerId !== event.pointerId || !dragState) return;
    const delta = axisValueFromPointerEvent(event) - pointerStartAxis;
    layoutState = applyPairDelta(dragState, panes, activeHandleIndex, delta);
    layoutState = applyPairSnap(layoutState, panes, activeHandleIndex, snapThreshold);
    emit('pointer', false);
  }

  function endPointerDrag(event: PointerEvent): void {
    if (activeHandleIndex === null || activePointerId !== event.pointerId) return;
    if (
      event.currentTarget instanceof HTMLElement &&
      'releasePointerCapture' in event.currentTarget
    ) {
      try {
        event.currentTarget.releasePointerCapture(event.pointerId);
      } catch {
        // Ignore capture release failures in incomplete DOM implementations.
      }
    }
    activeHandleIndex = null;
    activePointerId = null;
    dragState = null;
    emit('pointer', true);
  }

  function handleDoubleClick(handleIndex: number): void {
    if (!collapseOnDoubleClick || !layoutState) return;
    const result = toggleCollapseForHandle(layoutState, panes, handleIndex, collapseTarget);
    if (!result.changed) return;
    layoutState = result.state;
    emit('double-click', true);
  }

  function handleKeyDown(event: KeyboardEvent, handleIndex: number): void {
    if (!layoutState) return;
    const separatorOrientation = orientation === 'horizontal' ? 'vertical' : 'horizontal';
    const step = resolveKeyboardStep(keyboardStep, availablePanePixels, event.shiftKey ? 10 : 1);
    let nextState: ResizablePanelsLayoutState | null = null;

    if (separatorOrientation === 'vertical') {
      if (event.key === 'ArrowLeft')
        nextState = applyPairDelta(layoutState, panes, handleIndex, -step);
      if (event.key === 'ArrowRight')
        nextState = applyPairDelta(layoutState, panes, handleIndex, step);
    } else {
      if (event.key === 'ArrowUp')
        nextState = applyPairDelta(layoutState, panes, handleIndex, -step);
      if (event.key === 'ArrowDown')
        nextState = applyPairDelta(layoutState, panes, handleIndex, step);
    }

    if (event.key === 'Home') {
      nextState = setLeadingPanePixels(layoutState, panes, handleIndex, 0, {
        allowCollapsedLeadingMinimum: layoutState.panels[handleIndex]!.collapsed,
        allowCollapsedTrailingMinimum: layoutState.panels[handleIndex + 1]!.collapsed,
      });
    }

    if (event.key === 'End') {
      const pairTotal =
        layoutState.panels[handleIndex]!.sizePixels +
        layoutState.panels[handleIndex + 1]!.sizePixels;
      nextState = setLeadingPanePixels(layoutState, panes, handleIndex, pairTotal, {
        allowCollapsedLeadingMinimum: layoutState.panels[handleIndex]!.collapsed,
        allowCollapsedTrailingMinimum: layoutState.panels[handleIndex + 1]!.collapsed,
      });
    }

    if (!nextState) return;
    event.preventDefault();
    layoutState = applyPairSnap(nextState, panes, handleIndex, snapThreshold);
    emit('keyboard', true);
  }

  function paneContext(index: number): ResizablePanelRenderContext {
    if (!layoutState || availablePanePixels <= 0) {
      return unmeasuredSizes[index]!;
    }
    const runtime = layoutState.panels[index]!;
    const percentage =
      availablePanePixels > 0 ? (runtime.sizePixels / availablePanePixels) * 100 : 0;
    return {
      id: runtime.id,
      index,
      collapsed: runtime.collapsed,
      size:
        runtime.preferredUnit === 'px'
          ? { value: runtime.sizePixels, unit: 'px' }
          : { value: percentage, unit: 'percent' },
      pixelSize: runtime.sizePixels,
      percentage,
    };
  }

  function panelStyle(index: number): string | undefined {
    if (!layoutState || availablePanePixels <= 0) return undefined;
    return `--_cinder-resizable-panel-size:${layoutState.panels[index]!.sizePixels}px;`;
  }

  function handleAriaLabel(handleIndex: number): string {
    return `Resize ${panes[handleIndex]!.label} and ${panes[handleIndex + 1]!.label}`;
  }

  function handleAriaOrientation(): 'horizontal' | 'vertical' {
    return orientation === 'horizontal' ? 'vertical' : 'horizontal';
  }
</script>

<svelte:document
  onpointermove={activeHandleIndex !== null ? handlePointerMove : null}
  onpointerup={activeHandleIndex !== null ? endPointerDrag : null}
  onpointercancel={activeHandleIndex !== null ? endPointerDrag : null}
/>

<div
  {...rest}
  bind:this={rootElement}
  class={classNames('cinder-resizable-panels', className)}
  data-cinder-orientation={orientation}
>
  {#each panes as pane, index (pane.id)}
    <section
      id={`${componentId}-${pane.id}`}
      class="cinder-resizable-panels__pane"
      data-cinder-collapsed={paneContext(index).collapsed || undefined}
      style={panelStyle(index)}
    >
      {@render children(pane, paneContext(index))}
    </section>

    {#if index < panes.length - 1}
      {@const ariaState =
        layoutState && availablePanePixels > 0
          ? getHandleAriaState(layoutState, panes, index)
          : {
              valueNow: Math.round(unmeasuredSizes[index]!.percentage),
              valueMin: 0,
              valueMax: 100,
              valueText: `${Math.round(unmeasuredSizes[index]!.percentage)}% (0px)`,
            }}
      <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
      <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
      <span
        class="cinder-resizable-panels__handle"
        data-cinder-orientation={orientation}
        role="separator"
        tabindex="0"
        aria-controls={`${componentId}-${panes[index]!.id} ${componentId}-${panes[index + 1]!.id}`}
        aria-label={handleAriaLabel(index)}
        aria-orientation={handleAriaOrientation()}
        aria-valuemin={ariaState.valueMin}
        aria-valuemax={ariaState.valueMax}
        aria-valuenow={ariaState.valueNow}
        aria-valuetext={ariaState.valueText}
        onpointerdown={(event) => handlePointerDown(event, index)}
        onkeydown={(event) => handleKeyDown(event, index)}
        ondblclick={() => handleDoubleClick(index)}
      >
        <span aria-hidden="true" class="cinder-resizable-panels__handle-line"></span>
      </span>
    {/if}
  {/each}
</div>
