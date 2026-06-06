<script lang="ts" module>
  /**
   * @cinder
   * @category overlay
   * @status stable
   * @purpose Selectable menuitem inside a dropdown-menu that handles activation, keyboard support, and optional close-on-select behavior.
   * @tag overlay
   * @tag menu
   * @useWhen Rendering an individual action or link row inside a dropdown-menu.
   * @useWhen Composing menu rows that should close the parent dropdown after selection unless closeOnSelect is disabled.
   * @avoidWhen Used outside a dropdown context — it requires the dropdown provider and will throw otherwise.
   * @avoidWhen Grouping a static heading row above menu items — use dropdown-label.
   * @related dropdown, dropdown-menu, dropdown-label, dropdown-separator
   */
  export type {
    DropdownItemAnchorProps,
    DropdownItemButtonProps,
    DropdownItemProps,
    DropdownItemVariant,
  } from './dropdown-item.types.ts';
</script>

<script lang="ts">
  import type { HTMLAnchorAttributes, HTMLButtonAttributes } from 'svelte/elements';

  import type { DropdownItemProps } from './dropdown-item.types.ts';

  import { classNames } from '../../utilities/class-names.ts';
  import { getDropdownContext } from '../dropdown/dropdown.context.ts';

  let {
    variant = 'default',
    inset = false,
    disabled,
    closeOnSelect = true,
    class: customClassName,
    onclick,
    href,
    children,
    ...rest
  }: DropdownItemProps = $props();

  const context = getDropdownContext();

  const isLink = $derived(href !== undefined);

  const sharedClass = $derived(
    classNames(
      'cinder-_option-row',
      'cinder-dropdown-item',
      inset && 'cinder-dropdown-item--inset',
      customClassName,
    ),
  );

  type ButtonClickHandler = (
    event: MouseEvent & { currentTarget: EventTarget & HTMLButtonElement },
  ) => void;

  type AnchorClickHandler = (
    event: MouseEvent & { currentTarget: EventTarget & HTMLAnchorElement },
  ) => void;

  function handleClick(
    event: MouseEvent & { currentTarget: EventTarget & (HTMLButtonElement | HTMLAnchorElement) },
  ): void {
    if (disabled) {
      event.preventDefault();
      return;
    }
    if (typeof onclick === 'function') {
      if (isLink) {
        (onclick as AnchorClickHandler)(
          event as MouseEvent & { currentTarget: EventTarget & HTMLAnchorElement },
        );
      } else {
        (onclick as ButtonClickHandler)(
          event as MouseEvent & { currentTarget: EventTarget & HTMLButtonElement },
        );
      }
    }
    if (closeOnSelect) {
      context.close();
    }
  }

  const anchorAttributes = rest as Omit<HTMLAnchorAttributes, 'class' | 'href' | 'onclick'>;
  const buttonAttributes = rest as Omit<
    HTMLButtonAttributes,
    'class' | 'type' | 'disabled' | 'onclick'
  >;
  const buttonType = $derived((rest as { type?: HTMLButtonAttributes['type'] }).type ?? 'button');
</script>

<!--
  {...rest} is spread BEFORE the component-controlled attributes so a consumer
  cannot override role="menuitem", tabindex (the roving-focus model), aria-disabled,
  or the click handler — overriding any of those would break menu semantics.
-->
{#if isLink}
  <a
    {...anchorAttributes}
    {href}
    role="menuitem"
    class={sharedClass}
    data-cinder-variant={variant}
    tabindex={-1}
    data-disabled={disabled ? '' : undefined}
    aria-disabled={disabled ? 'true' : undefined}
    onclick={handleClick}
  >
    {#if children}
      {@render children()}
    {/if}
  </a>
{:else}
  <button
    {...buttonAttributes}
    type={buttonType}
    role="menuitem"
    class={sharedClass}
    data-cinder-variant={variant}
    tabindex={-1}
    data-disabled={disabled ? '' : undefined}
    aria-disabled={disabled ? 'true' : undefined}
    onclick={handleClick}
  >
    {#if children}
      {@render children()}
    {/if}
  </button>
{/if}
