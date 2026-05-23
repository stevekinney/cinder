<script lang="ts" module>
  /**
   * @cinder
   * @category overlay
   * @status stable
   * @purpose Accessible group boundary that clusters related dropdown-item rows inside a dropdown-menu.
   * @tag overlay
   * @tag menu
   * @useWhen Grouping related dropdown actions under one accessible heading.
   * @useWhen Pairing dropdown-label with a role='group' container inside dropdown-menu.
   * @avoidWhen Rendering a clickable row — use dropdown-item.
   * @avoidWhen Separating sections without a group label — use dropdown-separator.
   * @related dropdown, dropdown-menu, dropdown-item, dropdown-label, dropdown-separator
   */
  export type { DropdownGroupProps } from './dropdown-group.types.ts';
</script>

<script lang="ts">
  import type { DropdownGroupProps } from './dropdown-group.types.ts';

  import { classNames } from '../../utilities/class-names.ts';

  let {
    class: customClassName,
    children,
    ariaLabel,
    labelledBy,
    ...rest
  }: DropdownGroupProps = $props();

  function normalizeAccessibleName(
    value: string | undefined,
    propertyName: 'ariaLabel' | 'labelledBy',
  ): string | undefined {
    if (value === undefined) return undefined;
    const trimmedValue = value.trim();
    if (trimmedValue.length === 0) {
      throw new Error(`DropdownGroup requires a non-empty ${propertyName} value.`);
    }
    return trimmedValue;
  }

  const trimmedAriaLabel = $derived(normalizeAccessibleName(ariaLabel, 'ariaLabel'));
  const trimmedLabelledBy = $derived(normalizeAccessibleName(labelledBy, 'labelledBy'));

  $effect(() => {
    const namedByLabel = trimmedAriaLabel !== undefined;
    const namedByReference = trimmedLabelledBy !== undefined;

    if (namedByLabel === namedByReference) {
      throw new Error(
        'DropdownGroup requires exactly one accessible naming strategy: ariaLabel or labelledBy.',
      );
    }
  });
</script>

<div
  {...rest}
  class={classNames('cinder-dropdown-group', customClassName)}
  role="group"
  aria-label={trimmedAriaLabel}
  aria-labelledby={trimmedLabelledBy}
>
  {#if children}
    {@render children()}
  {/if}
</div>
