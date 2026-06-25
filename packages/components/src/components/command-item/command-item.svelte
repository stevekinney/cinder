<script lang="ts" module>
  /**
   * @cinder
   * @category action
   * @status stable
   * @purpose Single selectable row inside a command palette or inline command menu that registers itself with the parent command list.
   * @tag action
   * @tag command
   * @useWhen Declaring an individual command, action, or result row inside a command-palette or command-menu.
   * @useWhen Composing a custom palette layout via children rather than the items prop.
   * @avoidWhen Used outside a command-palette or command-menu ancestor — the component throws at construction.
   * @avoidWhen Rendering a generic dropdown choice — use dropdown-item instead.
   * @related command-palette, command-menu, dropdown-item
   */
  export type { CommandItemProps } from './command-item.types.ts';
</script>

<script lang="ts">
  import type { CommandItemProps } from './command-item.types.ts';
  import { untrack } from 'svelte';
  import type { Attachment } from 'svelte/attachments';

  import { classNames } from '../../utilities/class-names.ts';
  import {
    getCommandListContext,
    hasCommandListContext,
  } from '../_internal/command-list-context.ts';

  if (!hasCommandListContext()) {
    throw new Error('CommandItem must be used within a CommandPalette or CommandMenu.');
  }

  let {
    value,
    onselect = () => {},
    selectionMode = 'item',
    disabled = false,
    description,
    accessibleLabel,
    keyboardShortcut,
    leading,
    trailing,
    children,
    class: className,
  }: CommandItemProps = $props();

  const commandList = getCommandListContext();
  // Type-level mode marker: CommandPalette items own activation, while
  // CommandMenu items can opt into parent-owned activation. Read untracked
  // because this is a one-time discard, not a reactive dependency.
  void untrack(() => selectionMode);

  // Stable id assigned by the palette on registration.
  let itemId = $state<string | null>(null);

  // Register with the palette at attach time, unregister on detach. Using an
  // attachment (rather than onMount) means the DOM node is available at
  // registration, so the palette can sort items by document order for
  // keyboard navigation even when middle items remount via {#if}.
  const registerWithPalette: Attachment<HTMLElement> = (node) => {
    // Attachments run inside a tracked $effect. Without untrack, the register
    // call mutates the palette's $state registrations list, which feeds derived
    // values the attachment indirectly depends on — producing an update cycle.
    return untrack(() => {
      const { id, unregister } = commandList.register(
        {
          getValue: () => value,
          getOnselect: () => onselect,
          getDisabled: () => disabled,
        },
        node,
      );
      itemId = id;
      return () => {
        unregister();
        itemId = null;
      };
    });
  };

  const isActive = $derived(itemId !== null && commandList.activeItemId === itemId);
  const normalizedAccessibleLabel = $derived(normalizeOptionalAttribute(accessibleLabel));
  const normalizedKeyboardShortcut = $derived(normalizeOptionalAttribute(keyboardShortcut));

  function normalizeOptionalAttribute(value: string | undefined): string | undefined {
    const trimmed = value?.trim();
    return trimmed ? trimmed : undefined;
  }

  function handlePointerEnter() {
    if (!disabled && itemId !== null) {
      commandList.setActiveById(itemId);
    }
  }

  function handlePointerDown(event: PointerEvent) {
    // Prevent the input from losing focus when the user clicks an item.
    event.preventDefault();
  }

  function handleClick() {
    if (!disabled && itemId !== null) {
      commandList.activateItemById(itemId);
    }
  }
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<li
  {@attach registerWithPalette}
  id={itemId ?? undefined}
  role="option"
  class={classNames('cinder-command-item', className)}
  aria-selected={isActive}
  aria-disabled={disabled || undefined}
  aria-label={normalizedAccessibleLabel}
  aria-keyshortcuts={normalizedKeyboardShortcut}
  data-cinder-active={isActive ? '' : undefined}
  data-cinder-disabled={disabled || undefined}
  onpointerenter={handlePointerEnter}
  onpointerdown={handlePointerDown}
  onclick={handleClick}
>
  {#if leading}
    <span class="cinder-command-item__leading" aria-hidden="true">
      {@render leading()}
    </span>
  {/if}

  <span class="cinder-command-item__content">
    <span class="cinder-command-item__label cinder-_truncate">
      {@render children()}
    </span>
    {#if description}
      <span class="cinder-command-item__description cinder-_truncate">{description}</span>
    {/if}
  </span>

  {#if trailing}
    <span class="cinder-command-item__trailing" aria-hidden="true">
      {@render trailing()}
    </span>
  {/if}
</li>
