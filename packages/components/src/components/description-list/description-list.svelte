<script lang="ts" module>
  /**
   * @cinder
   * @category data-display
   * @status stable
   * @purpose Renders an ordered set of term and value pairs that describe attributes of a single entity.
   * @tag metadata
   * @tag key-value
   * @useWhen Summarizing the properties of one record such as a user profile or order detail.
   * @useWhen Switching between stacked and inline term layouts via the variant prop.
   * @avoidWhen Iterating over a homogenous collection of records — use data-list or table instead.
   * @related data-list, table
   */
  export type {
    DescriptionListItem,
    DescriptionListProps,
    DescriptionListVariant,
  } from './description-list.types.ts';
</script>

<script lang="ts">
  import type { DescriptionListProps } from './description-list.types.ts';
  import { classNames } from '../../utilities/class-names.ts';

  let {
    items,
    variant = 'default',
    class: className,
    actions,
    ...rest
  }: DescriptionListProps = $props();
</script>

<dl
  {...rest}
  class={classNames('cinder-description-list', className)}
  data-cinder-variant={variant}
>
  {#each items as item (item.id ?? item.term)}
    <div class="cinder-description-list__row">
      <dt class={variant === 'narrow' ? 'cinder-sr-only' : undefined}>{item.term}</dt>
      <dd>
        <div class="cinder-description-list__definition">{item.definition}</div>
        {#if actions}
          <div class="cinder-description-list__actions">{@render actions(item)}</div>
        {/if}
      </dd>
    </div>
  {/each}
</dl>
