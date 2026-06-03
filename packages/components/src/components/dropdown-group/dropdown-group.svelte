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

  // Resolve and validate the accessible name at render time so all three
  // invariants — non-empty ariaLabel, non-empty labelledBy, and exactly one of
  // the two — are enforced in a single place on both server and client, rather
  // than splitting the exclusivity check into a post-paint, SSR-skipped $effect.
  const resolvedAccessibleName = $derived.by(() => {
    const trimmedAriaLabel = normalizeAccessibleName(ariaLabel, 'ariaLabel');
    const trimmedLabelledBy = normalizeAccessibleName(labelledBy, 'labelledBy');

    const namedByLabel = trimmedAriaLabel !== undefined;
    const namedByReference = trimmedLabelledBy !== undefined;

    if (namedByLabel === namedByReference) {
      throw new Error(
        'DropdownGroup requires exactly one accessible naming strategy: ariaLabel or labelledBy.',
      );
    }

    return { ariaLabel: trimmedAriaLabel, labelledBy: trimmedLabelledBy };
  });
</script>

<div
  {...rest}
  class={classNames('cinder-dropdown-group', customClassName)}
  role="group"
  aria-label={resolvedAccessibleName.ariaLabel}
  aria-labelledby={resolvedAccessibleName.labelledBy}
>
  {#if children}
    {@render children()}
  {/if}
</div>
