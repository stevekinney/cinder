<script lang="ts" module>
  /**
   * @cinder
   * @category overlay
   * @status stable
   * @purpose Hover-and-focus triggered descriptive hint anchored to a focusable child element, wired through aria-describedby.
   * @tag overlay
   * @tag hint
   * @useWhen Showing a short non-interactive label or description for an icon-only button or terse control.
   * @useWhen Supplementing a control with a hint that should appear on hover or keyboard focus and dismiss on Escape.
   * @avoidWhen Hosting interactive content or focusable controls — use popover instead, since tooltip content is not reachable.
   * @avoidWhen Communicating the only accessible name for a control — use aria-label or visible text rather than tooltip text.
   * @related popover
   */
  export type { TooltipPlacement, TooltipProps } from './tooltip.types.ts';
</script>

<script lang="ts">
  import type { TooltipProps } from './tooltip.types.ts';
  import { onDestroy } from 'svelte';
  import type { Attachment } from 'svelte/attachments';
  import type { Placement } from '@floating-ui/dom';
  import { createAnchoredOverlay } from '../../_internal/anchored-overlay.svelte.ts';
  import { pushEscapeHandler } from '../../_internal/overlay.ts';
  import { classNames } from '../../utilities/class-names.ts';
  import { createPortalAttachment } from '../portal/index.ts';

  let {
    text,
    placement = 'top',
    describe = true,
    class: className,
    triggerRef = null,
    children,
  }: TooltipProps = $props();

  /**
   * Anchor-by-reference mode: the consumer owns the trigger's placement, so the
   * Tooltip renders only its panel. See {@link TooltipProps.triggerRef}.
   */
  const isDetached = $derived(triggerRef != null);

  const tooltipId = $props.id();
  const FOCUSABLE_SELECTOR = [
    'button:not([disabled])',
    'a[href]',
    'area[href]',
    'input:not([disabled])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    'summary',
    'iframe',
    'object',
    'embed',
    'audio[controls]',
    'video[controls]',
    '[contenteditable]:not([contenteditable="false"])',
    '[tabindex]:not([tabindex="-1"])',
  ].join(', ');

  let visible = $state(false);
  let showTimer: ReturnType<typeof setTimeout> | undefined;
  let releasePendingEscapeListener: (() => void) | undefined;
  let wrapperElement: HTMLSpanElement | undefined = $state();
  let tooltipElement: HTMLSpanElement | undefined = $state();
  let anchorElement = $state<HTMLElement | null>(null);

  function releasePendingEscape() {
    releasePendingEscapeListener?.();
    releasePendingEscapeListener = undefined;
  }

  function clearPendingShow() {
    clearTimeout(showTimer);
    showTimer = undefined;
    releasePendingEscape();
  }

  function handlePendingEscapeKeydown(event: KeyboardEvent) {
    if (event.key !== 'Escape') return;
    clearPendingShow();
  }

  function registerPendingEscape() {
    releasePendingEscape();
    document.addEventListener('keydown', handlePendingEscapeKeydown, { capture: true });
    releasePendingEscapeListener = () => {
      document.removeEventListener('keydown', handlePendingEscapeKeydown, { capture: true });
    };
  }

  function show() {
    clearPendingShow();
    registerPendingEscape();
    showTimer = setTimeout(() => {
      showTimer = undefined;
      releasePendingEscape();
      visible = true;
    }, 100);
  }

  function hide() {
    clearPendingShow();
    visible = false;
  }

  function handleMouseEnter() {
    show();
  }

  function handleMouseLeave() {
    hide();
  }

  function handleFocusIn() {
    show();
  }

  function handleFocusOut() {
    hide();
  }

  // WAI-ARIA APG: tooltips must be dismissible via Escape without losing
  // pointer or focus on the trigger. Hide the tooltip but don't blur — the
  // user keeps interacting with the trigger.
  function handleEscape(event: KeyboardEvent | undefined = undefined) {
    hide();
    event?.preventDefault();
  }

  function isFocusableCandidate(element: HTMLElement): boolean {
    if (element.matches(':disabled')) return false;
    return !element.closest('[hidden], [inert], [aria-hidden="true"]');
  }

  function resolveAnchorElement(container: HTMLElement): HTMLElement {
    const candidates = container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
    for (const candidate of candidates) {
      if (isFocusableCandidate(candidate)) return candidate;
    }
    return container;
  }

  function syncAriaDescribedBy(focusable: HTMLElement): () => void {
    const existing = focusable.getAttribute('aria-describedby');
    const ids = existing ? existing.split(' ').filter(Boolean) : [];
    if (!ids.includes(tooltipId)) {
      focusable.setAttribute('aria-describedby', [...ids, tooltipId].join(' '));
    }

    return () => {
      const current = focusable.getAttribute('aria-describedby');
      if (!current) return;
      const remaining = current
        .split(' ')
        .filter((id) => id !== tooltipId)
        .join(' ');
      if (remaining) {
        focusable.setAttribute('aria-describedby', remaining);
      } else {
        focusable.removeAttribute('aria-describedby');
      }
    };
  }

  /**
   * Detached mode's equivalent of `attachWrapper`: bind the same show/hide and
   * `aria-describedby` behavior to an element this component does not render.
   * Keyed on the element identity so a re-render with a new ref rebinds.
   */
  $effect(() => {
    const trigger = triggerRef;
    if (trigger == null) return;
    anchorElement = trigger;
    const teardownAriaDescribedBy = describe ? syncAriaDescribedBy(trigger) : undefined;
    trigger.addEventListener('mouseenter', handleMouseEnter);
    trigger.addEventListener('mouseleave', handleMouseLeave);
    trigger.addEventListener('focusin', handleFocusIn);
    trigger.addEventListener('focusout', handleFocusOut);
    return () => {
      teardownAriaDescribedBy?.();
      trigger.removeEventListener('mouseenter', handleMouseEnter);
      trigger.removeEventListener('mouseleave', handleMouseLeave);
      trigger.removeEventListener('focusin', handleFocusIn);
      trigger.removeEventListener('focusout', handleFocusOut);
      if (anchorElement === trigger) anchorElement = null;
    };
  });

  const attachWrapper: Attachment<HTMLSpanElement> = (element) => {
    wrapperElement = element;
    const focusable = resolveAnchorElement(element);
    anchorElement = focusable;
    const teardownAriaDescribedBy = describe ? syncAriaDescribedBy(focusable) : undefined;

    return () => {
      teardownAriaDescribedBy?.();
      if (wrapperElement === element) wrapperElement = undefined;
      if (anchorElement === focusable) anchorElement = null;
    };
  };

  const tooltipPortalAttachment = createPortalAttachment({
    /*
     * Gate the portal on visibility, so a Tooltip that is not showing leaves
     * nothing behind in `document.body`.
     *
     * Without this the panel was portaled on mount and stayed there for the
     * lifetime of the component — one detached `[role="tooltip"]` per Tooltip
     * instance accumulating in `document.body`. Every sibling overlay already
     * gates: Popover and HoverCard via
     * `{#if mounted && open && anchorElement}`, Portal/SpeedDial/NavigationBar/
     * DropdownMenu via an explicit `disabled` getter.
     *
     * `disabled` rather than wrapping the node in `{#if visible}`: the disabled
     * path calls `restoreInline()`, which returns the panel to its original
     * position inside the wrapper instead of unmounting it — so the
     * `aria-describedby` target keeps resolving while the tooltip is hidden.
     * Conditional rendering would break that association.
     *
     * NOTE this closes the client-side leak, NOT the SSR half of
     * OVERLAY-POLICY.md ("SSR markup is empty"). The panel span is rendered
     * unconditionally in the template, so server output still contains it —
     * deliberately, because it is the `aria-describedby` target and must exist
     * before hydration. See tooltip.a11y.md for that documented exception.
     *
     * Gated on `visible`, NOT on `isTooltipExposed`: the latter also requires
     * `positionReady`, and position is computed against the portaled node — so
     * gating on it would deadlock a tooltip that can never be positioned
     * because it was never portaled.
     */
    disabled: () => !visible,
    target: () => document.body,
    source: () => anchorElement ?? wrapperElement ?? null,
    inheritAttributes: true,
  });

  const anchoredOverlay = createAnchoredOverlay({
    open: () => visible,
    anchor: () => anchorElement,
    panel: () => tooltipElement,
    placement: () => placement as Placement,
    offset: () => 8,
    widthMode: () => 'none',
  });
  const isTooltipExposed = $derived(visible && anchoredOverlay.positionReady);

  onDestroy(clearPendingShow);

  $effect(() => {
    if (!visible) return;
    return pushEscapeHandler(handleEscape);
  });
</script>

<!--
  Presentational positioning wrapper. The hover/focus handlers only toggle
  tooltip visibility; the accessible tooltip semantics live on the role="tooltip"
  span below and the consumer's trigger child. role="presentation" keeps this
  wrapper out of the accessibility tree.
-->
<!--
  Two forms. By default the Tooltip renders a presentational wrapper around its
  trigger and anchors to it. With `triggerRef` the consumer owns the trigger, so
  only the panel renders — which is how a Tooltip can be used somewhere its
  panel must not appear in the trigger's own subtree (a `role="listitem"`, a
  table cell). See `TooltipProps.triggerRef`.
-->
{#if isDetached}
  <!-- The panel is the component ROOT here, so it takes `class` — in the
       wrapping form below that lands on the wrapper instead. -->
  <span
    id={tooltipId}
    bind:this={tooltipElement}
    role="tooltip"
    class={classNames('cinder-tooltip', className)}
    aria-hidden={!isTooltipExposed}
    data-cinder-placement={visible ? anchoredOverlay.resolvedPlacement : placement}
    data-cinder-position-ready={anchoredOverlay.positionReady}
    style={anchoredOverlay.positionStyle}
    {@attach tooltipPortalAttachment}
  >
    {text}
  </span>
{:else}
  <span
    class={classNames('cinder-tooltip-wrapper', className)}
    role="presentation"
    onmouseenter={handleMouseEnter}
    onmouseleave={handleMouseLeave}
    onfocusin={handleFocusIn}
    onfocusout={handleFocusOut}
    data-cinder-placement={visible ? anchoredOverlay.resolvedPlacement : placement}
    {@attach attachWrapper}
  >
    {@render children?.()}
    <span
      id={tooltipId}
      bind:this={tooltipElement}
      role="tooltip"
      class="cinder-tooltip"
      aria-hidden={!isTooltipExposed}
      data-cinder-placement={visible ? anchoredOverlay.resolvedPlacement : placement}
      data-cinder-position-ready={anchoredOverlay.positionReady}
      style={anchoredOverlay.positionStyle}
      {@attach tooltipPortalAttachment}
    >
      {text}
    </span>
  </span>
{/if}
