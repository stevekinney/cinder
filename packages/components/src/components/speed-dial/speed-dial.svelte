<script lang="ts" module>
  /**
   * @cinder
   * @category action
   * @status beta
   * @purpose Floating action cluster that reveals secondary quick actions around a primary FloatingAction trigger.
   * @tag action
   * @tag floating
   * @useWhen One primary floating action needs a small set of closely related quick actions.
   * @avoidWhen The actions are equally important and always visible - use toolbar instead. | toolbar
   * @avoidWhen The trigger should open rich contextual content - use popover instead. | popover
   * @related floating-action, toolbar, popover
   */
  export type {
    SpeedDialContext,
    SpeedDialDirection,
    SpeedDialProps,
    SpeedDialSchemaProps,
  } from './speed-dial.types.ts';
</script>

<script lang="ts">
  import type { Placement } from '@floating-ui/dom';
  import { createAnchoredOverlay } from '../../_internal/anchored-overlay.svelte.ts';
  import { classNames } from '../../utilities/class-names.ts';
  import { composedFocusScopes } from '../../utilities/focus.ts';
  import { handleRovingKeydown } from '../../utilities/roving-tabindex.ts';
  import FloatingAction from '../floating-action/floating-action.svelte';
  import { createPortalAttachment } from '../portal/index.ts';
  import {
    closestAcrossShadow,
    createInheritedPortalStyle,
    findNearestOpenTopLayer,
    getShadowHost,
    isRedispatchedPortaledEvent,
    observePortalSourceAvailability,
    redispatchPortaledEvent,
  } from '../portal/portal.utilities.svelte.ts';
  import { setSpeedDialContext } from './speed-dial.context.ts';
  import type { SpeedDialDirection, SpeedDialProps } from './speed-dial.types.ts';

  const actionsId = $props.id();
  const defaultAriaLabel = 'Quick actions';
  const documentFocusSelector =
    'button:not([disabled]), a[href], area[href], input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [contenteditable="true"], [tabindex]';

  let {
    open = $bindable(false),
    direction = 'up',
    hidden = false,
    'aria-label': ariaLabel = defaultAriaLabel,
    trigger,
    children,
    class: customClassName,
    ...rest
  }: SpeedDialProps = $props();

  let rootElement = $state<HTMLDivElement | null>(null);
  let triggerWrapperElement = $state<HTMLDivElement | null>(null);
  let actionsPortalScopeElement = $state<HTMLDivElement | null>(null);
  let actionsElement = $state<HTMLDivElement | null>(null);
  let spacingProbeElement = $state<HTMLSpanElement | null>(null);
  let spacingVersion = $state(0);
  let sourceSubtreeUnavailable = $state(false);
  let hasFocusedCurrentOpenSession = false;
  const actionButtons: HTMLButtonElement[] = [];

  const accessibleLabel = $derived(normalizeAriaLabel(ariaLabel));
  const placement = $derived<Placement>(
    direction === 'up'
      ? 'top'
      : direction === 'down'
        ? 'bottom'
        : direction === 'left'
          ? 'left'
          : 'right',
  );

  const actionsPortalScope = createPortalAttachment({
    disabled: () => !open || hidden || sourceSubtreeUnavailable,
    source: () => getTriggerElement(),
    target: () => getPortalTarget(),
  });
  const actionsPortal = createPortalAttachment({
    disabled: () => !open || hidden || sourceSubtreeUnavailable || !actionsPortalScopeElement,
    inheritAttributes: false,
    target: () => actionsPortalScopeElement,
  });
  const anchoredActions = createAnchoredOverlay({
    open: () => open,
    anchor: () => getTriggerElement(),
    panel: () => actionsElement,
    placement: () => placement,
    offset: () => {
      spacingVersion;
      return getSpacingOffset();
    },
    widthMode: () => 'none',
  });
  const resolvedDirection = $derived(
    anchoredActions.positionReady
      ? normalizePlacementDirection(anchoredActions.resolvedPlacement)
      : direction,
  );
  const orientation = $derived(
    resolvedDirection === 'left' || resolvedDirection === 'right' ? 'horizontal' : 'vertical',
  );
  const inheritedPortalStyle = createInheritedPortalStyle(
    () => getTriggerElement(),
    () => open && !hidden,
  );

  $effect(() => {
    if (!spacingProbeElement || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => spacingVersion++);
    observer.observe(spacingProbeElement);
    return () => observer.disconnect();
  });

  function normalizeAriaLabel(label: string | null | undefined): string {
    const trimmed = label?.trim() ?? '';
    return trimmed.length > 0 ? trimmed : defaultAriaLabel;
  }

  function getTriggerElement(): HTMLElement | null {
    return triggerWrapperElement?.querySelector<HTMLElement>('.cinder-floating-action') ?? null;
  }

  function getPortalTarget(): HTMLElement | null {
    const trigger = getTriggerElement();
    if (!trigger) return null;
    return findNearestOpenTopLayer(trigger);
  }

  function normalizePlacementDirection(value: string): SpeedDialDirection {
    const side = value.split('-')[0];
    if (side === 'top') return 'up';
    if (side === 'bottom') return 'down';
    if (side === 'left' || side === 'right') return side;
    return direction;
  }

  function getSpacingOffset(): number {
    const pixels = spacingProbeElement?.getBoundingClientRect().width;

    return pixels !== undefined && Number.isFinite(pixels) && pixels >= 0 ? pixels : 12;
  }

  function getEnabledActionButtons(): HTMLButtonElement[] {
    return actionButtons.filter((button) => !button.disabled && isRenderedCandidate(button));
  }

  function getKeyboardNavigationButtons(): HTMLButtonElement[] {
    const enabledButtons = getEnabledActionButtons();
    return resolvedDirection === 'up' || resolvedDirection === 'left'
      ? [...enabledButtons].reverse()
      : enabledButtons;
  }

  function getFocusTargetBeforeSpeedDial(): HTMLElement | null {
    const speedDialRoot = rootElement;
    if (!speedDialRoot || typeof document === 'undefined') return null;

    // Search the composed focus scope outward: the SpeedDial's own root
    // (its ShadowRoot, if it is rendered inside one) first, then each
    // enclosing shadow host's root in turn. A plain `document.
    // querySelectorAll` cannot see into shadow roots, so a SpeedDial
    // rendered inside one would otherwise skip a preceding sibling that
    // lives in that same shadow root.
    for (const { root, anchor } of composedFocusScopes(speedDialRoot)) {
      const preceding =
        Array.from(root.querySelectorAll<HTMLElement>(documentFocusSelector))
          .filter(
            (candidate) =>
              !hasNegativeTabIndex(candidate) &&
              !candidate.matches(':disabled') &&
              !speedDialRoot.contains(candidate) &&
              !actionsElement?.contains(candidate) &&
              !closestAcrossShadow(candidate, '[hidden], [inert], [aria-hidden="true"]') &&
              isRenderedCandidate(candidate) &&
              Boolean(candidate.compareDocumentPosition(anchor) & Node.DOCUMENT_POSITION_FOLLOWING),
          )
          .at(-1) ?? null;
      if (preceding) return preceding;
    }
    return null;
  }

  function isRenderedCandidate(candidate: HTMLElement): boolean {
    if (typeof window === 'undefined') return true;
    for (
      let current: HTMLElement | null = candidate;
      current;
      current = current.parentElement ?? getShadowHost(current)
    ) {
      const styles = getComputedStyle(current);
      if (styles.display === 'none' || styles.visibility === 'hidden') return false;
    }
    return true;
  }

  function hasNegativeTabIndex(element: HTMLElement): boolean {
    const tabIndex = element.getAttribute('tabindex');
    return tabIndex !== null && Number(tabIndex) < 0;
  }

  function focusTrigger(): void {
    queueMicrotask(() => getTriggerElement()?.focus());
  }

  function close(options: { focusTrigger?: boolean } = {}): void {
    open = false;
    if (options.focusTrigger) focusTrigger();
  }

  function register(button: HTMLButtonElement): void {
    if (actionButtons.includes(button)) return;
    actionButtons.push(button);
  }

  function unregister(button: HTMLButtonElement): void {
    const index = actionButtons.indexOf(button);
    if (index === -1) return;
    actionButtons.splice(index, 1);
  }

  function toggleOpen(): void {
    if (hidden) return;
    open = !open;
  }

  function handleTriggerKeydown(event: KeyboardEvent): void {
    if (hidden) return;

    if (
      event.key !== 'ArrowUp' &&
      event.key !== 'ArrowDown' &&
      event.key !== 'ArrowLeft' &&
      event.key !== 'ArrowRight'
    ) {
      return;
    }

    event.preventDefault();
    open = true;
    queueMicrotask(() => getEnabledActionButtons()[0]?.focus());
  }

  function handleActionsKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      close({ focusTrigger: true });
      return;
    }

    const target = event.target instanceof HTMLButtonElement ? event.target : null;
    if (!target) return;

    const tabOrderButtons = getEnabledActionButtons();
    if (event.key === 'Tab' && event.shiftKey && target === tabOrderButtons[0]) {
      const previousTarget = getFocusTargetBeforeSpeedDial();
      event.preventDefault();
      (previousTarget ?? getTriggerElement())?.focus();
      return;
    }
    if (event.key === 'Tab' && !event.shiftKey && target === tabOrderButtons.at(-1)) {
      event.preventDefault();
      getTriggerElement()?.focus();
      return;
    }

    const enabledButtons = getKeyboardNavigationButtons();
    const currentIndex = enabledButtons.indexOf(target);
    if (currentIndex === -1) return;

    const nextIndex = handleRovingKeydown(event, currentIndex, enabledButtons.length, {
      horizontal: orientation === 'horizontal',
      vertical: orientation === 'vertical',
    });
    if (nextIndex === null) return;

    event.preventDefault();
    enabledButtons[nextIndex]?.focus();
  }

  function bridgePortaledEvent(event: Event): void {
    if (isRedispatchedPortaledEvent(event)) return;
    redispatchPortaledEvent(event, rootElement);
  }

  function handlePortaledActionsKeydown(event: KeyboardEvent): void {
    if (isRedispatchedPortaledEvent(event)) return;
    if (!event.defaultPrevented) {
      handleActionsKeydown(event);
    }
    bridgePortaledEvent(event);
  }

  function bridgePortaledInteraction(event: Event): void {
    if (isRedispatchedPortaledEvent(event)) return;
    bridgePortaledEvent(event);
  }

  function handleDocumentClick(event: MouseEvent): void {
    if (!open) return;
    if (rootElement?.contains(event.target as Node)) return;
    if (actionsElement?.contains(event.target as Node)) return;
    close({
      focusTrigger:
        (rootElement?.contains(document.activeElement) ?? false) ||
        (actionsElement?.contains(document.activeElement) ?? false),
    });
  }

  $effect(() => {
    if (!open || hidden) {
      hasFocusedCurrentOpenSession = false;
      return;
    }
    if (!anchoredActions.positionReady || hasFocusedCurrentOpenSession) return;
    hasFocusedCurrentOpenSession = true;
    queueMicrotask(() => getEnabledActionButtons()[0]?.focus());
  });

  $effect(() => {
    const source = getTriggerElement() ?? rootElement;
    return observePortalSourceAvailability(source, (unavailable) => {
      sourceSubtreeUnavailable = unavailable;
      if (unavailable && open) {
        close();
      }
    });
  });

  setSpeedDialContext({
    get isOpen() {
      return open;
    },
    get direction() {
      return direction;
    },
    close,
    focusTrigger,
    register,
    unregister,
  });
</script>

<svelte:document onclick={handleDocumentClick} />

<div
  {...rest}
  bind:this={rootElement}
  hidden={hidden ? true : undefined}
  role="group"
  aria-label={accessibleLabel}
  aria-owns={open && !hidden ? actionsId : undefined}
  aria-hidden={hidden ? 'true' : undefined}
  inert={hidden ? true : undefined}
  class={classNames('cinder-speed-dial', customClassName)}
  data-cinder-open={open ? '' : undefined}
  data-cinder-direction={direction}
  data-cinder-hidden={hidden ? 'true' : undefined}
>
  <div
    bind:this={actionsPortalScopeElement}
    {@attach actionsPortalScope}
    class={classNames('cinder-speed-dial__portal-scope', 'cinder-speed-dial', customClassName)}
    style={`display: contents;${inheritedPortalStyle.style}`}
  ></div>
  <div
    bind:this={actionsElement}
    {@attach actionsPortal}
    id={actionsId}
    role="toolbar"
    aria-label="Actions"
    aria-orientation={orientation}
    class="cinder-_floating-surface cinder-speed-dial__actions"
    data-cinder-open={open ? '' : undefined}
    data-cinder-direction={resolvedDirection}
    data-cinder-position-ready={anchoredActions.positionReady || undefined}
    style={anchoredActions.positionStyle}
    aria-hidden={hidden || (open && !anchoredActions.positionReady) ? 'true' : undefined}
    inert={!open || hidden || sourceSubtreeUnavailable || (open && !anchoredActions.positionReady)
      ? true
      : undefined}
    tabindex="-1"
    onclick={bridgePortaledEvent}
    onkeydown={handlePortaledActionsKeydown}
    onfocusin={bridgePortaledInteraction}
    onfocusout={bridgePortaledInteraction}
    onpointerdown={bridgePortaledInteraction}
    onpointerup={bridgePortaledInteraction}
    oninput={bridgePortaledInteraction}
    onchange={bridgePortaledInteraction}
  >
    <span
      bind:this={spacingProbeElement}
      class="cinder-speed-dial__spacing-probe"
      aria-hidden="true"
    ></span>
    {@render children?.()}
  </div>

  <div bind:this={triggerWrapperElement} class="cinder-speed-dial__trigger">
    <FloatingAction
      aria-label={accessibleLabel}
      aria-expanded={open ? 'true' : 'false'}
      aria-controls={actionsId}
      disabled={hidden}
      tabindex={hidden ? -1 : undefined}
      onclick={toggleOpen}
      onkeydown={handleTriggerKeydown}
    >
      {@render trigger?.()}
    </FloatingAction>
  </div>
</div>
