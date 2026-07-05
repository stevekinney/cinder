<script lang="ts" module>
  /**
   * @cinder
   * @category action
   * @status beta
   * @purpose Full-width button row for selectable sidebars, timelines, and master-detail lists with leading, title, description, meta, and trailing regions.
   * @tag row
   * @tag list
   * @tag selection
   * @useWhen Selecting an item in-place from a vertical list, timeline, run list, or master-detail sidebar.
   * @useWhen A row must behave like a native button while presenting rich row metadata.
   * @avoidWhen Navigating to a URL — use stacked-list-item with href or navigation-item instead.
   * @avoidWhen Showing static record rows without button semantics — use stacked-list-item inside data-list.
   * @related stacked-list-item, data-list, button
   */
  export type {
    ActionRowCurrentValue,
    ActionRowDensity,
    ActionRowProps,
    ActionRowSelectedState,
  } from './action-row.types.ts';
</script>

<script lang="ts">
  import { classNames } from '../../utilities/class-names.ts';
  import type { ActionRowProps } from './action-row.types.ts';

  let {
    density = 'comfortable',
    selected = false,
    selectedState = 'pressed',
    currentValue = 'true',
    type = 'button',
    disabled,
    leading,
    title,
    description,
    meta,
    trailing,
    class: className,
    ...rest
  }: ActionRowProps = $props();

  const ariaPressed = $derived(selectedState === 'pressed' ? selected : undefined);
  const ariaCurrent = $derived(selectedState === 'current' && selected ? currentValue : undefined);
  const selectedDataAttribute = $derived(selected ? '' : undefined);
</script>

<button
  {...rest}
  {type}
  {disabled}
  class={classNames(
    'cinder-action-row',
    leading && 'cinder-action-row--has-leading',
    trailing && 'cinder-action-row--has-trailing',
    className,
  )}
  data-cinder-density={density}
  data-cinder-selected={selectedDataAttribute}
  aria-pressed={ariaPressed}
  aria-current={ariaCurrent}
>
  <span class="cinder-action-row__layout">
    {#if leading}
      <span class="cinder-action-row__leading">
        {@render leading()}
      </span>
    {/if}
    <span class="cinder-action-row__body">
      <span class="cinder-action-row__title">
        {@render title()}
      </span>
      {#if description}
        <span class="cinder-action-row__description">{@render description()}</span>
      {/if}
      {#if meta}
        <span class="cinder-action-row__meta">{@render meta()}</span>
      {/if}
    </span>
    {#if trailing}
      <span class="cinder-action-row__trailing">
        {@render trailing()}
      </span>
    {/if}
  </span>
</button>
