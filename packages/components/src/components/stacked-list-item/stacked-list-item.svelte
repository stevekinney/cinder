<script lang="ts" module>
  /**
   * @cinder
   * @category data-display
   * @status stable
   * @purpose Dense list row with leading, title, description, meta, and trailing slots that may optionally render as an anchor.
   * @tag list
   * @tag row
   * @useWhen Listing entities vertically with consistent leading icons or avatars and trailing actions.
   * @useWhen Linking each row to a detail view by passing href.
   * @avoidWhen Comparing tabular data across columns — use table instead.
   * @avoidWhen Rendering cards in a responsive grid — use grid-list instead.
   * @related grid-list-item, table-row, avatar
   */
  export type { StackedListItemDensity, StackedListItemProps } from './stacked-list-item.types.ts';
</script>

<script lang="ts">
  import { getDataListContext } from '../../_internal/data-list-context.ts';
  import type { StackedListItemProps } from './stacked-list-item.types.ts';
  import { classNames } from '../../utilities/class-names.ts';

  let {
    density,
    class: className,
    leading,
    title,
    description,
    meta,
    trailing,
    href,
    target,
    rel,
    hreflang,
    ...rest
  }: StackedListItemProps = $props();

  // Density resolution: an explicit per-row `density` prop wins; otherwise the
  // enclosing DataList's list-level density (if any) applies; otherwise the
  // row's own default of `comfortable`. A standalone StackedListItem (no
  // DataList ancestor) reads `undefined` from the context and uses the default.
  const dataListContext = getDataListContext();
  const resolvedDensity = $derived(density ?? dataListContext?.density ?? 'comfortable');

  // Filter out any attributes that TypeScript already blocks but which could
  // leak through at runtime (e.g. from dynamic spreads or JS consumers).
  // Strips on* event handlers plus role and tabindex to prevent the <li> from
  // becoming interactive — matching the accessibility contract in the a11y docs.
  // $derived so the filtered set re-evaluates when rest changes.
  const BLOCKED_ATTRS = new Set(['role', 'tabindex']);
  const safeRest = $derived(
    Object.fromEntries(
      Object.entries(rest).filter(([key]) => !key.startsWith('on') && !BLOCKED_ATTRS.has(key)),
    ) as Omit<typeof rest, `on${string}`>,
  );

  // When target="_blank" and no rel is supplied, default to "noreferrer" to
  // prevent reverse-tabnapping. $derived so it re-evaluates when target or rel changes.
  const resolvedRel = $derived(target === '_blank' && !rel ? 'noopener noreferrer' : rel);
</script>

<li
  class={classNames(
    'cinder-stacked-list-item',
    leading && 'cinder-stacked-list-item--has-leading',
    trailing && 'cinder-stacked-list-item--has-trailing',
    className,
  )}
  data-cinder-density={resolvedDensity}
  {...safeRest}
>
  <div class="cinder-stacked-list-item__layout">
    {#if leading}
      <div class="cinder-stacked-list-item__leading">
        {@render leading()}
      </div>
    {/if}
    <div class="cinder-stacked-list-item__body">
      <div class="cinder-stacked-list-item__title">
        {#if href !== undefined}
          <a
            class="cinder-stacked-list-item__title-link"
            {href}
            {target}
            rel={resolvedRel}
            {hreflang}
          >
            {@render title()}
          </a>
        {:else}
          {@render title()}
        {/if}
      </div>
      {#if description}
        <div class="cinder-stacked-list-item__description">{@render description()}</div>
      {/if}
      {#if meta}
        <div class="cinder-stacked-list-item__meta">{@render meta()}</div>
      {/if}
    </div>
    {#if trailing}
      <div class="cinder-stacked-list-item__trailing">
        {@render trailing()}
      </div>
    {/if}
  </div>
</li>
