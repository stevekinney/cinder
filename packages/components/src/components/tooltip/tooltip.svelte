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
  import { createAnchoredOverlayExitState } from '../../_internal/anchored-overlay-exit.svelte.ts';
  import { pushEscapeHandler } from '../../_internal/overlay.ts';
  import { classNames } from '../../utilities/class-names.ts';
  import { useReducedMotion } from '../../utilities/use-reduced-motion.svelte.ts';
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
   *
   * Retained through a closing session, not read directly off `triggerRef`:
   * a consumer can clear `triggerRef` (e.g. unmount the referenced element)
   * in the same update that starts a close. Reading `triggerRef != null`
   * directly would flip `isDetached` to `false` mid-fade, switching the
   * template from the detached branch to the wrapping branch — discarding
   * the retained panel and its exit transition entirely, even though
   * `exitState.renderPanel` correctly says a session is still closing.
   * Mirrors Popover's `lastAnchorElement` retention pattern.
   */
  let lastIsDetached = $state(false);
  $effect(() => {
    if (triggerRef != null) {
      lastIsDetached = true;
      return;
    }
    // Only clear once there's no active (open or closing) session to retain
    // it for — same effect-ordering reason as Popover's snapshots: gating on
    // `exitState.renderPanel` here (not `visible`/`exitState.isClosing`)
    // reads the CURRENT retention need rather than a one-tick-stale value.
    if (!exitState.renderPanel) {
      lastIsDetached = false;
    }
  });
  const isDetached = $derived(triggerRef != null || lastIsDetached);

  /*
   * OVERLAY-POLICY.md's SSR rule is a HARD CONSTRAINT: overlays render nothing
   * on the server, whatever their initial state. Tooltip did not satisfy it —
   * the panel was always in the template — and an earlier revision of this
   * branch wrote itself a "documented exception" in tooltip.a11y.md instead,
   * on the belief that the panel had to exist server-side as the
   * `aria-describedby` target.
   *
   * It does not. `syncAriaDescribedBy` runs from an attachment (wrapping mode)
   * and an `$effect` (detached mode), both client-only, so the server renders
   * no `aria-describedby` either. Reference and target appear together after
   * hydration, and gating the panel leaves nothing dangling.
   */
  let hydrated = $state(false);
  $effect(() => {
    hydrated = true;
  });

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
      // If the trigger ref was CLEARED (not merely swapped to a different
      // element — checked against the live `triggerRef`, not the captured
      // `trigger`) while the tooltip is genuinely visible, force it to
      // start closing now. `lastIsDetached`/`exitState.renderPanel`
      // retention above exists ONLY to keep the panel positioned/mounted
      // through the resulting exit transition — without this, a triggerRef
      // cleared while `visible` was still true left the tooltip visibly
      // portaled against a removed trigger with no event source left to
      // ever dismiss it (no mouseleave/focusout can fire on an element
      // that's gone).
      if (triggerRef == null && visible) {
        hide();
      }
      // Don't null the anchor while a session is still closing: `anchor()`
      // below reads `anchorElement` directly, and `createAnchoredOverlay`
      // clears its position when `anchor()` returns null — nulling this the
      // instant `triggerRef` is cleared (same tick a close can start) would
      // strand the retained (detached-mode-retained, see `lastIsDetached`
      // above) panel with no positioning through its own exit transition.
      if (anchorElement === trigger && !exitState.renderPanel) anchorElement = null;
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
     * This closes the CLIENT leak; the `hydrated` gate on the panel above is
     * what satisfies the SSR half of the policy.
     *
     * Gated on `visible`, NOT on `isTooltipExposed`: the latter also requires
     * `positionReady`, and position is computed against the portaled node — so
     * gating on it would deadlock a tooltip that can never be positioned
     * because it was never portaled.
     */
    disabled: () => !exitState.renderPanel,
    target: () => document.body,
    source: () => anchorElement ?? wrapperElement ?? null,
    inheritAttributes: true,
  });

  const reducedMotion = useReducedMotion();
  // Shared anchored-overlay exit-transition lifecycle (OVERLAY-POLICY.md §
  // "Transition lifecycle"). The tooltip element never unmounts, so
  // `renderPanel`/`isClosing` drive `data-cinder-visible`/`data-cinder-closing`
  // rather than an `{#if}` gate — but the a11y-visible fade-out still awaits
  // the real transition instead of snapping away via `visibility`.
  const exitState = createAnchoredOverlayExitState({
    getOpen: () => visible,
    getPanelElement: () => tooltipElement,
    getReducedMotion: () => reducedMotion.current,
  });

  const anchoredOverlay = createAnchoredOverlay({
    // Gated on `exitState.renderPanel`, not `exitState.isClosing`: `$effect`s
    // (where `exitState.sync()` runs, and where `isClosing` actually flips
    // true) fire after a render has already committed. Whenever a visible
    // tooltip closes, `visible` flips `false` in THIS render, one tick
    // before `exitState.sync()` ever runs — so `isClosing` still reads its
    // pre-close (false) value here, and `createAnchoredOverlay` would
    // briefly take its closed path, clearing `positionStyle`/`positionReady`
    // for a tick before the async Floating UI recomputation restores them —
    // the retained (`data-cinder-visible`) tooltip would start its fade from
    // an unpositioned fixed location. `renderPanel` doesn't have this lag.
    //
    // `open()` is `exitState.renderPanel` ALONE, not `visible ||
    // exitState.renderPanel`: this callback runs inside
    // `createAnchoredOverlay`'s own positioning `$effect`, so reading the
    // raw `visible` prop here — even behind an `||` whose overall result
    // doesn't change — still subscribes that effect to `visible` as a
    // fine-grained dependency (Svelte tracks every signal an effect reads
    // during its run, not just whether the return value changed), causing
    // it to briefly tear down/rebuild on every ordinary close. `renderPanel`
    // is already `true` throughout the whole open session and only changes
    // at genuine session boundaries — see Popover's `anchoredOverlay` for
    // the fuller explanation of this same fix (CIN-376 round 12).
    open: () => exitState.renderPanel,
    anchor: () => anchorElement,
    panel: () => tooltipElement,
    placement: () => placement as Placement,
    offset: () => 8,
    widthMode: () => 'none',
  });
  const isTooltipExposed = $derived(visible && anchoredOverlay.positionReady);

  onDestroy(clearPendingShow);
  onDestroy(() => {
    exitState.destroy();
  });

  $effect(() => {
    exitState.sync();
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
<!--
  Two forms. By default the Tooltip renders a presentational wrapper around its
  trigger and anchors to it. With `triggerRef` the consumer owns the trigger, so
  only the panel renders — which is how a Tooltip can be used somewhere its
  panel must not appear in the trigger's own subtree (a `role="listitem"`, a
  table cell). See `TooltipProps.triggerRef`.
-->
{#if isDetached}
  {#if hydrated}
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
      data-cinder-visible={exitState.renderPanel ? '' : undefined}
      data-cinder-closing={exitState.isClosing ? '' : undefined}
      style={anchoredOverlay.positionStyle}
      {@attach tooltipPortalAttachment}
    >
      {text}
    </span>
  {/if}
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
    {#if hydrated}
      <span
        id={tooltipId}
        bind:this={tooltipElement}
        role="tooltip"
        class="cinder-tooltip"
        aria-hidden={!isTooltipExposed}
        data-cinder-placement={visible ? anchoredOverlay.resolvedPlacement : placement}
        data-cinder-position-ready={anchoredOverlay.positionReady}
        data-cinder-visible={exitState.renderPanel ? '' : undefined}
        data-cinder-closing={exitState.isClosing ? '' : undefined}
        style={anchoredOverlay.positionStyle}
        {@attach tooltipPortalAttachment}
      >
        {text}
      </span>
    {/if}
  </span>
{/if}
