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
    children,
  }: TooltipProps = $props();

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
  let wrapperElement: HTMLSpanElement | undefined = $state();
  let tooltipElement: HTMLSpanElement | undefined = $state();
  let anchorElement = $state<HTMLElement | null>(null);

  function show() {
    clearTimeout(showTimer);
    showTimer = setTimeout(() => {
      showTimer = undefined;
      visible = true;
    }, 100);
  }

  function hide() {
    clearTimeout(showTimer);
    showTimer = undefined;
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

  $effect(() => {
    return () => {
      clearTimeout(showTimer);
    };
  });

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
  {@render children()}

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
