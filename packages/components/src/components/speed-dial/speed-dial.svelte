<script lang="ts" module>
  /**
   * @cinder
   * @category action
   * @status beta
   * @purpose Floating action cluster that reveals secondary quick actions around a primary FloatingActionButton trigger.
   * @tag action
   * @tag floating
   * @useWhen One primary floating action needs a small set of closely related quick actions.
   * @avoidWhen The actions are equally important and always visible - use toolbar instead. | toolbar
   * @avoidWhen The trigger should open rich contextual content - use popover instead. | popover
   * @related floating-action-button, toolbar, popover
   */
  export type {
    SpeedDialContext,
    SpeedDialDirection,
    SpeedDialProps,
    SpeedDialSchemaProps,
  } from './speed-dial.types.ts';
</script>

<script lang="ts">
  import { classNames } from '../../utilities/class-names.ts';
  import { handleRovingKeydown } from '../../utilities/roving-tabindex.ts';
  import FloatingActionButton from '../floating-action-button/floating-action-button.svelte';
  import { setSpeedDialContext } from './speed-dial.context.ts';
  import type { SpeedDialProps } from './speed-dial.types.ts';

  const actionsId = $props.id();

  let {
    open = $bindable(false),
    direction = 'up',
    hidden = false,
    'aria-label': ariaLabel = 'Quick actions',
    trigger,
    children,
    class: customClassName,
    ...rest
  }: SpeedDialProps = $props();

  let rootElement = $state<HTMLDivElement | null>(null);
  let triggerWrapperElement = $state<HTMLDivElement | null>(null);
  const actionButtons: HTMLButtonElement[] = [];

  const orientation = $derived(
    direction === 'left' || direction === 'right' ? 'horizontal' : 'vertical',
  );

  function getTriggerElement(): HTMLElement | null {
    return triggerWrapperElement?.querySelector<HTMLElement>('.cinder-fab') ?? null;
  }

  function getEnabledActionButtons(): HTMLButtonElement[] {
    return actionButtons.filter((button) => !button.disabled);
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

    const enabledButtons = getEnabledActionButtons();
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
    close();
  }

  $effect(() => {
    if (!open) return;
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
  role="group"
  aria-label={ariaLabel}
  aria-hidden={hidden ? 'true' : undefined}
  inert={hidden ? true : undefined}
  class={classNames('cinder-speed-dial', customClassName)}
  data-cinder-open={open ? 'true' : 'false'}
  data-cinder-direction={direction}
  data-cinder-hidden={hidden ? 'true' : undefined}
>
  <div
    id={actionsId}
    role="toolbar"
    aria-label={`${ariaLabel} actions`}
    aria-orientation={orientation}
    class="cinder-speed-dial__actions"
    data-cinder-open={open ? 'true' : 'false'}
    inert={!open ? true : undefined}
    tabindex="-1"
    onkeydown={handleActionsKeydown}
  >
    {@render children?.()}
  </div>

  <div bind:this={triggerWrapperElement} class="cinder-speed-dial__trigger">
    <FloatingActionButton
      aria-label={ariaLabel}
      aria-expanded={open ? 'true' : 'false'}
      aria-haspopup="true"
      aria-controls={actionsId}
      disabled={hidden}
      tabindex={hidden ? -1 : undefined}
      onclick={toggleOpen}
      onkeydown={handleTriggerKeydown}
    >
      {@render trigger?.()}
    </FloatingActionButton>
  </div>
</div>
