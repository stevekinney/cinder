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
  import { handleRovingKeydown } from '../../utilities/roving-tabindex.ts';
  import FloatingAction from '../floating-action/floating-action.svelte';
  import { createPortalAttachment } from '../portal/index.ts';
  import { setSpeedDialContext } from './speed-dial.context.ts';
  import type { SpeedDialProps } from './speed-dial.types.ts';

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
  let actionsElement = $state<HTMLDivElement | null>(null);
  const actionButtons: HTMLButtonElement[] = [];

  const orientation = $derived(
    direction === 'left' || direction === 'right' ? 'horizontal' : 'vertical',
  );
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

  const actionsPortal = createPortalAttachment({
    disabled: () => !open || hidden,
    source: () => getTriggerElement(),
    target: () => getPortalTarget(),
  });
  const anchoredActions = createAnchoredOverlay({
    open: () => open,
    anchor: () => getTriggerElement(),
    panel: () => actionsElement,
    placement: () => placement,
    offset: () => getSpacingOffset(),
    widthMode: () => 'none',
  });

  function normalizeAriaLabel(label: string | null | undefined): string {
    const trimmed = label?.trim() ?? '';
    return trimmed.length > 0 ? trimmed : defaultAriaLabel;
  }

  function getTriggerElement(): HTMLElement | null {
    return triggerWrapperElement?.querySelector<HTMLElement>('.cinder-floating-action') ?? null;
  }

  function getPortalTarget(): HTMLElement | null {
    return getTriggerElement()?.closest<HTMLElement>('dialog[open]') ?? null;
  }

  function getSpacingOffset(): number {
    const trigger = getTriggerElement();
    if (!trigger || typeof window === 'undefined') return 12;
    const value = getComputedStyle(trigger).getPropertyValue('--cinder-space-3').trim();
    const parsed = Number.parseFloat(value);
    if (!Number.isFinite(parsed)) return 12;
    if (value.endsWith('rem')) {
      const root = Number.parseFloat(getComputedStyle(document.documentElement).fontSize);
      return parsed * (Number.isFinite(root) && root > 0 ? root : 16);
    }
    return parsed;
  }

  function getEnabledActionButtons(): HTMLButtonElement[] {
    return actionButtons.filter((button) => !button.disabled);
  }

  function getKeyboardNavigationButtons(): HTMLButtonElement[] {
    const enabledButtons = getEnabledActionButtons();
    return direction === 'up' || direction === 'left'
      ? [...enabledButtons].reverse()
      : enabledButtons;
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
    if (!open || hidden || !anchoredActions.positionReady) return;
    queueMicrotask(() => getEnabledActionButtons()[0]?.focus());
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
    bind:this={actionsElement}
    {@attach actionsPortal}
    id={actionsId}
    role="toolbar"
    aria-label="Actions"
    aria-orientation={orientation}
    class="cinder-speed-dial__actions"
    data-cinder-open={open ? '' : undefined}
    data-cinder-direction={anchoredActions.positionReady
      ? anchoredActions.resolvedPlacement.split('-')[0]
      : direction}
    data-cinder-position-ready={anchoredActions.positionReady || undefined}
    style={anchoredActions.positionStyle}
    aria-hidden={hidden || (open && !anchoredActions.positionReady) ? 'true' : undefined}
    inert={!open || hidden ? true : undefined}
    tabindex="-1"
    onkeydown={handleActionsKeydown}
  >
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
