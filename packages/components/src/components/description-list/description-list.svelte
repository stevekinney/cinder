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
  import { devWarn } from '../../utilities/dev-warn.ts';

  let {
    items,
    variant = 'default',
    class: className,
    actions,
    ...rest
  }: DescriptionListProps = $props();

  // The each-block keys on `item.id ?? item.term`. Two rows that share a term and
  // omit `id` collide, which Svelte surfaces as a hard `each_key_duplicate` error
  // in dev and as broken DOM reconciliation in production. Surface the misuse with
  // an actionable diagnostic before the reconciler trips, so the consumer is told
  // to supply `id` rather than left to debug a cryptic error.
  const duplicateKey = $derived.by(() => {
    const seen = new Set<string | number>();
    for (const item of items) {
      const key = item.id ?? item.term;
      if (seen.has(key)) return key;
      seen.add(key);
    }
    return undefined;
  });

  // Warn at most once per distinct duplicate key. devWarn does not dedupe, so without
  // this latch the effect would re-spam the console on every reactive update (item
  // edits, unrelated prop changes) while the duplicate persists.
  let lastWarnedDuplicateKey: string | undefined;
  $effect(() => {
    if (duplicateKey === undefined) {
      lastWarnedDuplicateKey = undefined;
      return;
    }
    if (duplicateKey !== lastWarnedDuplicateKey) {
      lastWarnedDuplicateKey = duplicateKey;
      devWarn(
        `[cinder/DescriptionList] Duplicate key "${duplicateKey}". Two items share a term and no \`id\`. Provide a unique \`id\` on each DescriptionListItem to avoid broken reconciliation.`,
      );
    }
  });
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
