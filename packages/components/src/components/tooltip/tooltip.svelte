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
  import { autoUpdate, computePosition, flip, offset, shift } from '@floating-ui/dom';
  import { cn } from '../../utilities/class-names.ts';
  import { useId } from '../../utilities/use-id.ts';

  let {
    text,
    placement = 'top',
    describe = true,
    class: className,
    children,
  }: TooltipProps = $props();

  const tooltipId = useId('cinder-tooltip');
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
  let hasPendingShow = $state(false);
  let wrapperElement: HTMLSpanElement | undefined = $state();
  let tooltipElement: HTMLSpanElement | undefined = $state();
  let anchorElement = $state<HTMLElement | null>(null);
  let computedPlacement = $state<Placement>(placement);
  let positionStyle = $state('');
  let positionReady = $state(false);
  const isTooltipExposed = $derived(visible && positionReady);

  function show() {
    clearTimeout(showTimer);
    hasPendingShow = true;
    showTimer = setTimeout(() => {
      showTimer = undefined;
      hasPendingShow = false;
      visible = true;
    }, 100);
  }

  function hide() {
    clearTimeout(showTimer);
    showTimer = undefined;
    hasPendingShow = false;
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
  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      hide();
    }
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

  const portalTooltipToDocumentBody: Attachment<HTMLSpanElement> = (element) => {
    tooltipElement = element;
    const inheritedRoot = anchorElement ?? wrapperElement ?? element.parentElement ?? undefined;
    const inheritedDirection = inheritedRoot?.closest<HTMLElement>('[dir]')?.getAttribute('dir');
    if (inheritedDirection) {
      element.setAttribute('dir', inheritedDirection);
    }
    const inheritedTheme = inheritedRoot
      ?.closest<HTMLElement>('[data-cinder-theme]')
      ?.getAttribute('data-cinder-theme');
    if (inheritedTheme) {
      element.setAttribute('data-cinder-theme', inheritedTheme);
    }
    document.body.appendChild(element);

    return () => {
      if (tooltipElement === element) tooltipElement = undefined;
      element.remove();
    };
  };

  $effect(() => {
    if (!visible && !hasPendingShow) return;
    document.addEventListener('keydown', handleKeydown);
    return () => {
      document.removeEventListener('keydown', handleKeydown);
    };
  });

  $effect(() => {
    if (!visible) {
      computedPlacement = placement;
      positionStyle = '';
      positionReady = false;
      return;
    }
    if (!anchorElement || !tooltipElement) return;

    const anchor = anchorElement;
    const tooltip = tooltipElement;
    const placementSnapshot = placement;
    let cancelled = false;
    let generation = 0;

    const updatePosition = async () => {
      const myGeneration = ++generation;
      try {
        const result = await computePosition(anchor, tooltip, {
          placement: placementSnapshot,
          middleware: [offset(8), flip(), shift({ padding: 8 })],
          strategy: 'fixed',
        });
        if (cancelled || myGeneration !== generation) return;
        positionStyle = `left: ${result.x}px; top: ${result.y}px;`;
        computedPlacement = result.placement;
        positionReady = true;
      } catch {
        if (cancelled || myGeneration !== generation) return;
        positionStyle = '';
        computedPlacement = placementSnapshot;
        positionReady = false;
      }
    };

    const stopAutoUpdate = autoUpdate(anchor, tooltip, () => {
      void updatePosition();
    });

    return () => {
      cancelled = true;
      stopAutoUpdate();
      positionStyle = '';
      computedPlacement = placementSnapshot;
      positionReady = false;
    };
  });
</script>

<span
  class={cn('cinder-tooltip-wrapper', className)}
  onmouseenter={handleMouseEnter}
  onmouseleave={handleMouseLeave}
  onfocusin={handleFocusIn}
  onfocusout={handleFocusOut}
  data-cinder-placement={visible ? computedPlacement : placement}
  {@attach attachWrapper}
>
  {@render children()}

  <span
    id={tooltipId}
    role="tooltip"
    class="cinder-tooltip"
    aria-hidden={!isTooltipExposed}
    data-cinder-placement={visible ? computedPlacement : placement}
    data-cinder-position-ready={positionReady}
    style={positionStyle}
    {@attach portalTooltipToDocumentBody}
  >
    {text}
  </span>
</span>
