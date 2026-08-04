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
  import {
    composedFocusScopes,
    getSequentialFocusTargets,
    getTabIndexValue,
    type SequentialFocusTarget,
  } from '../../utilities/focus.ts';
  import { handleRovingKeydown } from '../../utilities/roving-tabindex.ts';
  import FloatingAction from '../floating-action/floating-action.svelte';
  import { createPortalAttachment } from '../portal/index.ts';
  import {
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
    const buttons = actionsElement
      ? Array.from(
          actionsElement.querySelectorAll<HTMLButtonElement>('button.cinder-floating-action'),
        )
      : actionButtons;
    return buttons.filter((button) => !button.disabled && isRenderedCandidate(button));
  }

  // A consumer can forward `tabindex="-1"` to a SpeedDialAction to keep it
  // clickable and reachable by arrow keys while excluding it from sequential
  // Tab navigation. Boundary detection (which button ends the Tab sequence in
  // either direction) must use only sequentially tabbable buttons, or a
  // tabindex="-1" first/last action gets treated as the Tab boundary even
  // though native Tab would skip over it.
  function getSequentiallyTabbableActionButtons(): HTMLButtonElement[] {
    return getEnabledActionButtons().filter((button) => !hasNegativeTabIndex(button));
  }

  function getKeyboardNavigationButtons(enabledButtons: HTMLButtonElement[]): HTMLButtonElement[] {
    return resolvedDirection === 'up' || resolvedDirection === 'left'
      ? [...enabledButtons].reverse()
      : enabledButtons;
  }

  function getFocusTargetBeforeSpeedDial(): SequentialFocusTarget | null {
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
        getSequentialFocusTargets(root, {
          relativeTo: anchor,
          direction: 'before',
        })
          .filter(
            (candidate) =>
              !speedDialRoot.contains(candidate) && !actionsElement?.contains(candidate),
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
    return getTabIndexValue(element) < 0;
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

    if (open && event.key === 'Tab' && event.shiftKey) {
      const sequentialButtons = getSequentiallyTabbableActionButtons();
      if (!actionsElement || !anchoredActions.positionReady || actionsElement.hasAttribute('inert'))
        return;
      const lastButton = sequentialButtons.at(-1);
      if (!lastButton) return;
      event.preventDefault();
      lastButton.focus();
      return;
    }

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

    const enabledButtons = getEnabledActionButtons();
    const tabOrderButtons = enabledButtons.filter((button) => !hasNegativeTabIndex(button));
    const targetIndex = enabledButtons.indexOf(target);
    const firstTabOrderIndex = tabOrderButtons.length
      ? enabledButtons.indexOf(tabOrderButtons[0]!)
      : -1;
    const lastTabOrderIndex = tabOrderButtons.length
      ? enabledButtons.indexOf(tabOrderButtons.at(-1)!)
      : -1;
    if (
      event.key === 'Tab' &&
      event.shiftKey &&
      targetIndex !== -1 &&
      (firstTabOrderIndex === -1 || targetIndex <= firstTabOrderIndex)
    ) {
      const previousTarget = getFocusTargetBeforeSpeedDial();
      event.preventDefault();
      (previousTarget ?? getTriggerElement())?.focus();
      return;
    }
    if (
      event.key === 'Tab' &&
      !event.shiftKey &&
      targetIndex !== -1 &&
      (lastTabOrderIndex === -1 || targetIndex >= lastTabOrderIndex)
    ) {
      event.preventDefault();
      getTriggerElement()?.focus();
      return;
    }

    const keyboardButtons = getKeyboardNavigationButtons(enabledButtons);
    const currentIndex = keyboardButtons.indexOf(target);
    if (currentIndex === -1) return;

    const nextIndex = handleRovingKeydown(event, currentIndex, keyboardButtons.length, {
      horizontal: orientation === 'horizontal',
      vertical: orientation === 'vertical',
    });
    if (nextIndex === null) return;

    event.preventDefault();
    keyboardButtons[nextIndex]?.focus();
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
