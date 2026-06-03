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
  export type { DropdownItemProps, DropdownItemVariant } from './dropdown-item.types.ts';
</script>

<script lang="ts">
  import type { DropdownItemProps } from './dropdown-item.types.ts';
  import { getContext, hasContext } from 'svelte';

  import { classNames } from '../../utilities/class-names.ts';
  import { DROPDOWN_CONTEXT } from '../dropdown/dropdown.context.ts';
  import type { DropdownContext } from '../dropdown/dropdown.types.ts';

  if (!hasContext(DROPDOWN_CONTEXT)) {
    throw new Error('DropdownItem must be used within a Dropdown.');
  }

  let {
    variant = 'default',
    inset = false,
    disabled,
    closeOnSelect = true,
    class: customClassName,
    onclick,
    children,
    ...rest
  }: DropdownItemProps = $props();

  const context = getContext<DropdownContext>(DROPDOWN_CONTEXT);

  type DropdownItemClickHandler = (
    event: MouseEvent & { currentTarget: EventTarget & HTMLButtonElement },
  ) => void;

  function handleClick(
    event: MouseEvent & { currentTarget: EventTarget & HTMLButtonElement },
  ): void {
    if (disabled) return;
    if (typeof onclick === 'function') {
      (onclick as DropdownItemClickHandler)(event);
    }
    if (closeOnSelect) {
      context.close();
    }
  }
</script>

<!--
  {...rest} is spread BEFORE the component-controlled attributes so a consumer
  cannot override role="menuitem", tabindex (the roving-focus model), aria-disabled,
  or the click handler — overriding any of those would break menu semantics.
-->
<button
  {...rest}
  type="button"
  role="menuitem"
  class={classNames(
    'cinder-_option-row',
    'cinder-dropdown-item',
    inset && 'cinder-dropdown-item--inset',
    customClassName,
  )}
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
