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
  import { pushEscapeHandler } from '../../_internal/overlay.ts';
  import { classNames } from '../../utilities/class-names.ts';
  import { createPortalAttachment } from '../portal/index.ts';

  let {
    open = $bindable(false),
    onopenchange,
    openDelay = 300,
    closeDelay = 150,
    placement = 'bottom-start',
    offset = 8,
    showArrow = false,
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
    open: () => open,
    anchor: () => anchorElement,
    panel: () => cardElement,
    arrow: () => arrowElement,
    placement: () => placement as Placement,
    offset: () => offset,
    showArrow: () => showArrow,
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
    onopenchange?.(nextOpen);
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

  $effect(() => {
    mounted = true;
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

{#if mounted && open && anchorElement}
  <div
    bind:this={cardElement}
    id={cardId}
    class={classNames('cinder-_floating-surface', 'cinder-hover-card', className)}
    role="tooltip"
    data-cinder-placement={anchoredOverlay.resolvedPlacement}
    data-cinder-position-ready={anchoredOverlay.positionReady}
    style={anchoredOverlay.positionStyle}
    onmouseenter={handleCardMouseEnter}
    onmouseleave={handleCardMouseLeave}
    onfocusin={handleCardFocusIn}
    onfocusout={handleCardFocusOut}
    {@attach portalAttachment}
  >
    {@render children()}
    {#if showArrow}
      <span
        bind:this={arrowElement}
        class="cinder-hover-card__arrow"
        style={anchoredOverlay.arrowStyle}
      ></span>
    {/if}
  </div>
{/if}
