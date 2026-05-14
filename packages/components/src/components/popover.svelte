<script lang="ts" module>
  import type { Snippet } from 'svelte';

  /** Public placement union. floating-ui may flip to wider placements at runtime. */
  export type PopoverPlacement =
    | 'top'
    | 'bottom'
    | 'left'
    | 'right'
    | 'top-start'
    | 'top-end'
    | 'bottom-start'
    | 'bottom-end';

  export type PopoverRole = 'dialog' | 'group' | 'listbox';

  export type PopoverProps = {
    /** Open state. Bindable. Default `false`. */
    open?: boolean;
    /** Anchor placement. Default `'bottom-start'`. */
    placement?: PopoverPlacement;
    /** Distance in px between trigger and panel. Default `8`. */
    offset?: number;
    /** Render a directional arrow on the panel. Default `false`. */
    showArrow?: boolean;
    /** Accessible name. Sets `aria-label` when `ariaLabelledby` is not supplied. */
    label?: string;
    /** Id of an element labelling the panel. Wins over `label`. */
    ariaLabelledby?: string;
    /** Explicit anchor element. Wins over the snippet-resolved focusable. */
    triggerRef?: HTMLElement | null;
    /** Panel content. Required. */
    children: Snippet;
    /** Optional trigger snippet rendered inside a wrapper. */
    trigger?: Snippet;
    /** ARIA role for the panel. Default `'dialog'`. */
    role?: PopoverRole;
    /** Extra class merged onto `.cinder-popover`. */
    class?: string;
  };
</script>

<script lang="ts">
  import { onDestroy, untrack } from 'svelte';
  import { DEV } from 'esm-env';
  import { captureFocus, restoreFocusTo, pushEscapeHandler } from '../_internal/overlay.ts';
  import { classNames } from '../utilities/class-names.ts';
  import { useId } from '../utilities/use-id.ts';
  import {
    computePosition,
    autoUpdate,
    flip,
    shift,
    offset as offsetMw,
    arrow as arrowMw,
  } from '@floating-ui/dom';
  import type { Placement } from '@floating-ui/dom';

  let {
    open = $bindable(false),
    placement = 'bottom-start',
    offset = 8,
    showArrow = false,
    label,
    ariaLabelledby,
    triggerRef = null,
    trigger,
    children,
    role = 'dialog',
    class: className,
  }: PopoverProps = $props();

  const FOCUSABLE_SELECTOR =
    'button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"]), input:not([disabled]), select:not([disabled]), textarea:not([disabled])';

  function findFirstFocusable(container: HTMLElement | undefined | null): HTMLElement | null {
    if (!container) return null;
    const candidates = container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
    for (const el of candidates) {
      if (el.closest('[hidden], [inert], [aria-hidden="true"]')) continue;
      return el;
    }
    return null;
  }

  let triggerWrapper: HTMLDivElement | undefined = $state();
  let panelElement: HTMLDivElement | undefined = $state();
  let arrowElement: HTMLSpanElement | undefined = $state();

  const panelId = useId('cinder-popover');

  const resolvedPlacement = $derived<Placement>(placement ?? 'bottom-start');
  let computedPlacement = $state<Placement>('bottom-start');

  const anchorElement = $derived<HTMLElement | null>(
    triggerRef && triggerRef.isConnected
      ? triggerRef
      : (findFirstFocusable(triggerWrapper) ?? null),
  );

  let mounted = $state(false);
  let positionReady = $state(false);
  let pendingInitialFocus = $state(false);
  let positionStyle = $state('');
  let arrowStyle = $state('');

  let capturedFocus: HTMLElement | null = null;
  let resolvedAnchorAtOpen: HTMLElement | null = null;

  let isDestroyed = false;
  onDestroy(() => {
    isDestroyed = true;
  });

  // Effect A — mount flag (SSR-empty gate).
  $effect(() => {
    mounted = true;
  });

  function handleDocumentMousedown(event: MouseEvent) {
    if (!panelElement) return;
    const target = event.target as Node | null;
    if (!target) return;
    if (panelElement.contains(target)) return;
    if (anchorElement && anchorElement.contains(target)) return;
    open = false;
  }

  // Effect B — open lifecycle.
  $effect(() => {
    if (!open) return;
    capturedFocus = captureFocus();
    // Anchor snapshot for focus-restore; untrack so anchor/trigger changes while
    // open don't retrigger the open effect (positioning rebind is Effect C's job).
    resolvedAnchorAtOpen = untrack(() => anchorElement);
    const releaseEscape = pushEscapeHandler(() => {
      open = false;
    });
    document.addEventListener('mousedown', handleDocumentMousedown, { capture: true });
    pendingInitialFocus = true;

    return () => {
      pendingInitialFocus = false;
      releaseEscape();
      document.removeEventListener('mousedown', handleDocumentMousedown, { capture: true });
      if (isDestroyed) {
        capturedFocus = null;
        resolvedAnchorAtOpen = null;
        return;
      }
      const target =
        (triggerRef && triggerRef.isConnected && triggerRef) ||
        (resolvedAnchorAtOpen && resolvedAnchorAtOpen.isConnected && resolvedAnchorAtOpen) ||
        (capturedFocus && capturedFocus.isConnected && capturedFocus) ||
        null;
      restoreFocusTo(target);
      capturedFocus = null;
      resolvedAnchorAtOpen = null;
      positionReady = false;
      positionStyle = '';
      arrowStyle = '';
      computedPlacement = resolvedPlacement;
    };
  });

  // Effect B-2 — state-driven initial-focus move.
  $effect(() => {
    if (isDestroyed) return;
    if (!open || !panelElement || !anchorElement || !positionReady || !pendingInitialFocus) return;
    if (!resolvedAnchorAtOpen) resolvedAnchorAtOpen = anchorElement;
    const focusable = findFirstFocusable(panelElement);
    (focusable ?? panelElement).focus();
    pendingInitialFocus = false;
  });

  // Effect B-3 — dev-only no-anchor warning.
  let warnedNoAnchor = false;
  let warnedNoName = false;
  let warnedListbox = false;

  $effect(() => {
    if (!DEV) return;
    if (!open) return;
    if (anchorElement) return;
    if (warnedNoAnchor) return;
    warnedNoAnchor = true;
    console.warn(
      '[cinder/popover] open without a trigger anchor. ' +
        'Provide either a `trigger` snippet with a focusable child or a `triggerRef`.',
    );
  });

  // Effect B-4 — dev-only dialog-without-name warning.
  $effect(() => {
    if (!DEV) return;
    if (!open) return;
    if (role !== 'dialog') return;
    if (label || ariaLabelledby) return;
    if (warnedNoName) return;
    warnedNoName = true;
    console.warn(
      '[cinder/popover] role="dialog" without `label` or `ariaLabelledby` falls back to ' +
        'aria-label="Popover". Pass a descriptive name for production usage.',
    );
  });

  // Effect B-5 — dev-only listbox guidance.
  $effect(() => {
    if (!DEV) return;
    if (role !== 'listbox') return;
    if (warnedListbox) return;
    warnedListbox = true;
    console.warn(
      '[cinder/popover] role="listbox" only sets the surface role. ' +
        'You must render role="option" children and own selection/keyboard semantics. ' +
        'See popover.a11y.md §Role.',
    );
  });

  // Effect C — positioning lifecycle.
  $effect(() => {
    if (!open) return;
    if (!anchorElement || !panelElement) return;

    const anchor = anchorElement;
    const panel = panelElement;
    const arrowEl = arrowElement;
    const placementSnap = resolvedPlacement;
    const off = offset;
    const arrowEnabled = showArrow;
    let cancelled = false;
    let generation = 0;

    const middleware = [
      offsetMw(off),
      flip(),
      shift({ padding: 8 }),
      ...(arrowEnabled && arrowEl ? [arrowMw({ element: arrowEl })] : []),
    ];

    const stop = autoUpdate(anchor, panel, async () => {
      if (cancelled) return;
      const myGeneration = ++generation;
      const result = await computePosition(anchor, panel, {
        placement: placementSnap,
        middleware,
        strategy: 'fixed',
      });
      if (cancelled || myGeneration !== generation) return;
      positionStyle = `left: ${result.x}px; top: ${result.y}px;`;
      computedPlacement = result.placement;
      arrowStyle = '';
      if (arrowEnabled && result.middlewareData.arrow) {
        const { x, y } = result.middlewareData.arrow;
        arrowStyle = `${x != null ? `left: ${x}px;` : ''}${y != null ? `top: ${y}px;` : ''}`;
      }
      positionReady = true;
    });

    return () => {
      cancelled = true;
      stop();
      positionReady = false;
      positionStyle = '';
      arrowStyle = '';
    };
  });

  // Effect D — trigger ARIA wiring.
  $effect(() => {
    const target = anchorElement;
    if (!target) return;
    const prior = {
      expanded: target.getAttribute('aria-expanded'),
      controls: target.getAttribute('aria-controls'),
      haspopup: target.getAttribute('aria-haspopup'),
    };

    target.setAttribute('aria-expanded', String(open));
    const mappedHaspopup = role === 'group' ? null : role === 'listbox' ? 'listbox' : 'dialog';
    if (mappedHaspopup) target.setAttribute('aria-haspopup', mappedHaspopup);
    else target.removeAttribute('aria-haspopup');
    if (open) target.setAttribute('aria-controls', panelId);
    else target.removeAttribute('aria-controls');

    return () => {
      for (const [name, value] of Object.entries({
        'aria-expanded': prior.expanded,
        'aria-controls': prior.controls,
        'aria-haspopup': prior.haspopup,
      })) {
        if (value === null) target.removeAttribute(name);
        else target.setAttribute(name, value);
      }
    };
  });
</script>

{#if trigger}
  <div bind:this={triggerWrapper} class="cinder-popover__trigger">
    {@render trigger()}
  </div>
{/if}

{#if mounted && open && anchorElement}
  <div
    bind:this={panelElement}
    id={panelId}
    {role}
    aria-label={ariaLabelledby ? undefined : (label ?? 'Popover')}
    aria-labelledby={ariaLabelledby}
    class={classNames('cinder-popover', className)}
    data-cinder-placement={computedPlacement}
    data-cinder-position-ready={positionReady}
    style={positionStyle}
    tabindex="-1"
  >
    {@render children()}
    {#if showArrow}
      <span
        bind:this={arrowElement}
        class="cinder-popover__arrow"
        aria-hidden="true"
        style={arrowStyle}
      ></span>
    {/if}
  </div>
{/if}
