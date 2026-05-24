<script lang="ts" module>
  /**
   * @cinder
   * @category data-display
   * @status stable
   * @purpose Overlapping collaborator avatar stack built on the Avatar primitive with keyboard-discoverable names and overflow count.
   * @tag identity
   * @tag collaboration
   * @useWhen Showing who is present, assigned, or collaborating in a compact surface.
   * @useWhen Summarizing a bounded set of people with a visible overflow count.
   * @avoidWhen Rendering a single person — use avatar instead.
   * @avoidWhen Showing status, counts, or metadata labels unrelated to people — use badge, chip, or status-dot instead.
   * @related avatar, badge, tooltip, status-dot
   */
  export type {
    AvatarGroupItem,
    AvatarGroupProps,
    AvatarGroupZOrder,
  } from './avatar-group.types.ts';
</script>

<script lang="ts">
  import type { AvatarGroupProps } from './avatar-group.types.ts';
  import { classNames } from '../../utilities/class-names.ts';
  import Avatar from '../avatar/avatar.svelte';
  import Tooltip from '../tooltip/tooltip.svelte';

  const defaultMaxVisible = 5;

  let {
    avatars = [],
    maxVisible = defaultMaxVisible,
    overlap = '0.75rem',
    zOrder = 'last-on-top',
    size = 'md',
    shape = 'circle',
    overflowLabel,
    class: className,
    style,
    ...rest
  }: AvatarGroupProps = $props();

  const normalizedMaxVisible = $derived(normalizeMaxVisible(maxVisible));
  const visibleCount = $derived(Math.min(normalizedMaxVisible, avatars.length));
  const hiddenCount = $derived(Math.max(0, avatars.length - visibleCount));
  const hasOverflow = $derived(hiddenCount > 0);
  const computedOverflowLabel = $derived(overflowLabel ?? `${hiddenCount} more collaborators`);
  const rootStyle = $derived(
    [style, `--cinder-avatar-group-overlap: ${overlap}`].filter(Boolean).join('; '),
  );

  const visibleAvatars = $derived(
    avatars.slice(0, visibleCount).map((avatar, index) => ({
      avatar,
      key: avatar.id ?? `${avatar.name}:${index}`,
      trimmedName: avatar.name.trim(),
      stackIndex: getVisibleStackIndex(index, visibleCount, zOrder),
    })),
  );

  const overflowStackIndex = $derived(visibleCount === 0 ? 0 : visibleCount + 1);

  function normalizeMaxVisible(value: number): number {
    if (!Number.isFinite(value)) return defaultMaxVisible;
    return Math.max(0, Math.floor(value));
  }

  function getVisibleStackIndex(
    index: number,
    count: number,
    order: NonNullable<AvatarGroupProps['zOrder']>,
  ): number {
    if (order === 'first-on-top') return count - index;
    return index + 1;
  }

  function avatarSourceProps(src: string | undefined): { src?: string } {
    return src === undefined ? {} : { src };
  }
</script>

<div
  {...rest}
  class={classNames('cinder-avatar-group', className)}
  style={rootStyle}
  role="list"
  data-cinder-size={size}
  data-cinder-shape={shape}
  data-cinder-z-order={zOrder}
>
  {#each visibleAvatars as item (item.key)}
    <span
      class="cinder-avatar-group__item"
      role="listitem"
      style={`--cinder-avatar-group-index: ${item.stackIndex}`}
    >
      {#if item.trimmedName}
        <Tooltip text={item.trimmedName}>
          <!-- Focusable tooltip disclosure target; not an actionable control. -->
          <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
          <span class="cinder-avatar-group__trigger" tabindex="0" aria-label={item.trimmedName}>
            <Avatar
              {...avatarSourceProps(item.avatar.src)}
              name={item.trimmedName}
              alt=""
              {size}
              {shape}
            />
          </span>
        </Tooltip>
      {:else}
        <span class="cinder-avatar-group__trigger">
          <Avatar {...avatarSourceProps(item.avatar.src)} name="" alt="" {size} {shape} />
        </span>
      {/if}
    </span>
  {/each}

  {#if hasOverflow}
    <span
      class="cinder-avatar-group__item cinder-avatar-group__overflow"
      role="listitem"
      aria-label={computedOverflowLabel}
      style={`--cinder-avatar-group-index: ${overflowStackIndex}`}
    >
      +{hiddenCount}
    </span>
  {/if}
</div>
