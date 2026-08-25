<script lang="ts" module>
  /**
   * @cinder
   * @category overlay
   * @status stable
   * @purpose Hover-and-focus triggered rich preview card for non-interactive contextual content.
   * @tag overlay
   * @tag hover
   * @useWhen Showing a profile, issue, or metadata preview that is richer than a tooltip but still read-only.
   * @useWhen Revealing supplementary preview content on pointer hover or keyboard focus without moving focus.
   * @avoidWhen The floating content contains focusable controls — use popover.
   * @avoidWhen The trigger needs a short accessible description — use tooltip.
   * @related tooltip, popover
   */
  export type { HoverCardPlacement, HoverCardProps } from './hover-card.types.ts';
</script>

<script lang="ts">
  import type { HoverCardProps } from './hover-card.types.ts';
  import { onDestroy } from 'svelte';
  import { devWarn } from '../../utilities/dev-warn.ts';
  import type { Placement } from '@floating-ui/dom';
  import { createAnchoredOverlay } from '../../_internal/anchored-overlay.svelte.ts';
  import { createAnchoredOverlayExitState } from '../../_internal/anchored-overlay-exit.svelte.ts';
  import { pushEscapeHandler } from '../../_internal/overlay.ts';
  import { classNames } from '../../utilities/class-names.ts';
  import { useReducedMotion } from '../../utilities/use-reduced-motion.svelte.ts';
  import { createPortalAttachment } from '../portal/index.ts';

  let {
    open = $bindable(false),
    onOpenChange,
    openDelay = 300,
    closeDelay = 150,
    placement = 'bottom-start',
    offset = 8,
    arrowVisible = false,
    trigger,
    children,
    triggerRef = null,
    description,
    class: className,
  }: HoverCardProps = $props();

  const baseId = $props.id();
  const cardId = `${baseId}-card`;
  const descriptionId = `${baseId}-description`;
  const focusableSelector =
    'button, a[href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

  let mounted = $state(false);
  let triggerWrapper = $state<HTMLSpanElement | null>(null);
  let cardElement = $state<HTMLDivElement | null>(null);
  let arrowElement = $state<HTMLSpanElement | null>(null);
  let pointerInsideTrigger = false;
  let pointerInsideCard = false;
  let focusInsideTrigger = false;
  let focusInsideCard = false;
  let suppressTriggerOpenUntilLeave = false;
  let openTimer: ReturnType<typeof setTimeout> | undefined;
  let closeTimer: ReturnType<typeof setTimeout> | undefined;
  const reducedMotion = useReducedMotion();
  // Shared anchored-overlay exit-transition lifecycle (OVERLAY-POLICY.md §
  // "Transition lifecycle"). Keeps the card mounted (`renderCard`) for the
  // duration of its exit transition instead of destroying it the instant
  // `open` flips false, and generation-guards a reopen mid-close so a stale
  // completion callback can't unmount the freshly reopened card — this is
  // the defect the hand-rolled version used to have.
  const exitState = createAnchoredOverlayExitState({
    getOpen: () => open,
    getPanelElement: () => cardElement,
    getReducedMotion: () => reducedMotion.current,
  });

  const anchorElement = $derived<HTMLElement | null>(
    triggerRef && triggerRef.isConnected ? triggerRef : triggerWrapper,
  );
  const describedBy = $derived(
    [open ? cardId : undefined, description ? descriptionId : undefined]
      .filter(Boolean)
      .join(' ') || undefined,
  );

  const portalAttachment = createPortalAttachment({
    target: () => document.body,
    source: () => anchorElement,
    inheritAttributes: true,
  });

  const anchoredOverlay = createAnchoredOverlay({
    // Gated on `exitState.renderPanel`, not `exitState.isClosing`: `$effect`s
    // (where `exitState.sync()` runs, and where `isClosing` actually flips
    // true) fire after a render has already committed. On every ordinary
    // close, `open` becomes `false` in THIS render, one tick before
    // `exitState.sync()` ever runs — so `isClosing` still reads its
    // pre-close (false) value here, and `createAnchoredOverlay` would
    // briefly take its closed path, clearing `positionStyle` (see
    // anchored-overlay.svelte.ts) for a tick before the async Floating UI
    // recomputation restores it, so the still-visible, still-mounted card
    // would jump to its unpositioned fallback spot before fading out in
    // place. `renderPanel` doesn't have this lag: it's a plain `$state`
    // that's already `true` from the prior render and isn't reset until the
    // completion callback actually fires.
    //
    // `open()` is `exitState.renderPanel` ALONE, not `open ||
    // exitState.renderPanel`: this callback runs inside
    // `createAnchoredOverlay`'s own positioning `$effect`, so reading the
    // raw `open` prop here — even behind an `||` whose overall result
    // doesn't change — still subscribes that effect to `open` as a
    // fine-grained dependency, causing it to briefly tear down/rebuild on
    // every ordinary close. `renderPanel` alone is stable throughout the
    // open session — see Popover's `anchoredOverlay` for the fuller
    // explanation of this same fix (CIN-376 round 12).
    open: () => exitState.renderPanel,
    anchor: () => anchorElement,
    panel: () => cardElement,
    arrow: () => arrowElement,
    placement: () => placement as Placement,
    offset: () => offset,
    arrowVisible: () => arrowVisible,
    widthMode: () => 'content',
  });

  function clearTimers() {
    clearTimeout(openTimer);
    clearTimeout(closeTimer);
    openTimer = undefined;
    closeTimer = undefined;
  }

  function setOpen(nextOpen: boolean) {
    if (open === nextOpen) return;
    open = nextOpen;
    onOpenChange?.(nextOpen);
  }

  function hasInterest() {
    return pointerInsideTrigger || pointerInsideCard || focusInsideTrigger || focusInsideCard;
  }

  function clearInterest() {
    suppressTriggerOpenUntilLeave ||= pointerInsideTrigger;
    pointerInsideTrigger = false;
    pointerInsideCard = false;
    focusInsideTrigger = false;
    focusInsideCard = false;
  }

  function scheduleOpen(delay = openDelay) {
    clearTimers();
    openTimer = setTimeout(
      () => {
        openTimer = undefined;
        if (hasInterest()) setOpen(true);
      },
      Math.max(0, delay),
    );
  }

  function scheduleClose() {
    clearTimers();
    closeTimer = setTimeout(
      () => {
        closeTimer = undefined;
        if (!hasInterest()) setOpen(false);
      },
      Math.max(0, closeDelay),
    );
  }

  function handleTriggerMouseEnter() {
    if (suppressTriggerOpenUntilLeave) return;
    pointerInsideTrigger = true;
    scheduleOpen();
  }

  function handleTriggerMouseLeave() {
    suppressTriggerOpenUntilLeave = false;
    pointerInsideTrigger = false;
    scheduleClose();
  }

  function handleCardMouseEnter() {
    pointerInsideCard = true;
    clearTimers();
  }

  function handleCardMouseLeave() {
    pointerInsideCard = false;
    scheduleClose();
  }

  function handleTriggerFocusIn() {
    focusInsideTrigger = true;
    if (suppressTriggerOpenUntilLeave) return;
    scheduleOpen(0);
  }

  function handleTriggerFocusOut(event: FocusEvent) {
    const nextTarget = event.relatedTarget;
    focusInsideTrigger =
      nextTarget instanceof Node &&
      Boolean(triggerWrapper?.contains(nextTarget) || cardElement?.contains(nextTarget));
    if (!focusInsideTrigger) {
      suppressTriggerOpenUntilLeave = false;
      scheduleClose();
    }
  }

  function handleCardFocusIn() {
    focusInsideCard = true;
    clearTimers();
  }

  function handleCardFocusOut(event: FocusEvent) {
    const nextTarget = event.relatedTarget;
    focusInsideCard = nextTarget instanceof Node && Boolean(cardElement?.contains(nextTarget));
    if (!focusInsideCard) scheduleClose();
  }

  function handleEscape(event: KeyboardEvent | undefined = undefined) {
    if (!open) return;
    event?.preventDefault();
    setOpen(false);
  }

  onDestroy(clearTimers);
  onDestroy(() => {
    exitState.destroy();
  });

  $effect(() => {
    mounted = true;
  });

  // Drives the shared exit-transition lifecycle: mounts immediately on open,
  // and on close keeps the card mounted (`exitState.renderPanel`) until the
  // exit transition genuinely finishes. See anchored-overlay-exit.svelte.ts.
  $effect(() => {
    exitState.sync();
  });

  $effect(() => {
    if (!open) return;
    return pushEscapeHandler(handleEscape);
  });

  $effect(() => {
    if (open) return;
    clearTimers();
    clearInterest();
  });

  $effect(() => {
    if (!open || !cardElement) return;
    const focusable = cardElement.querySelector(focusableSelector);
    if (focusable) {
      devWarn('HoverCard content should be non-interactive. Use Popover for focusable content.');
    }
  });
</script>

<span
  bind:this={triggerWrapper}
  class="cinder-hover-card__trigger"
  {...describedBy ? { 'aria-describedby': describedBy } : {}}
  onmouseenter={handleTriggerMouseEnter}
  onmouseleave={handleTriggerMouseLeave}
  onfocusin={handleTriggerFocusIn}
  onfocusout={handleTriggerFocusOut}
>
  {@render trigger()}
</span>

{#if description}
  <span id={descriptionId} class="cinder-sr-only">{description}</span>
{/if}

{#if mounted && exitState.renderPanel && anchorElement}
  <!--
    `aria-hidden`, deliberately NOT `inert`, while closing (CIN-376 round 17
    review): `describedBy` already removes this card's id from the trigger's
    `aria-describedby` the instant the close starts, but the retained,
    portaled `role="tooltip"` element itself stayed mounted and
    accessibility-visible for the whole exit transition — exposing dismissed
    preview content as a standalone tooltip during the fade, longer still if
    a consumer overrides the duration token. `aria-hidden` closes that gap.
    `inert` would ALSO suppress the `mouseenter`/`focusin` handlers below,
    which is exactly what the reopen-mid-close defect fix (CIN-376's whole
    point for HoverCard) depends on: hovering back over a still-closing card
    must cancel the close and reopen it. `aria-hidden` and pointer/focus
    interactivity are not mutually exclusive — this hides it from assistive
    technology without blocking the re-entry that keeps it open.
  -->
  <div
    bind:this={cardElement}
    id={cardId}
    class={classNames('cinder-_floating-surface', 'cinder-hover-card', className)}
    role="tooltip"
    data-cinder-placement={anchoredOverlay.resolvedPlacement}
    data-cinder-position-ready={anchoredOverlay.positionReady}
    data-cinder-closing={exitState.isClosing ? '' : undefined}
    aria-hidden={exitState.isClosing ? 'true' : undefined}
    style={anchoredOverlay.positionStyle}
    onmouseenter={handleCardMouseEnter}
    onmouseleave={handleCardMouseLeave}
    onfocusin={handleCardFocusIn}
    onfocusout={handleCardFocusOut}
    {@attach portalAttachment}
  >
    {@render children()}
    {#if arrowVisible}
      <span
        bind:this={arrowElement}
        class="cinder-hover-card__arrow"
        style={anchoredOverlay.arrowStyle}
      ></span>
    {/if}
  </div>
{/if}
