<script lang="ts" module>
  /**
   * @cinder
   * @category data-display
   * @status stable
   * @purpose Overlapping collaborator avatar stack built on the Avatar primitive with focusable names and overflow count.
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
    label = 'Collaborators',
    class: className,
    style,
    ...rest
  }: AvatarGroupProps = $props();

  const normalizedMaxVisible = $derived(normalizeMaxVisible(maxVisible));
  const visibleCount = $derived(Math.min(normalizedMaxVisible, avatars.length));
  const hiddenCount = $derived(Math.max(0, avatars.length - visibleCount));
  const hasOverflow = $derived(hiddenCount > 0);
  const computedOverflowLabel = $derived(overflowLabel ?? `${hiddenCount} more collaborators`);
  const normalizedOverlap = $derived(normalizeOverlap(overlap));
  const identityCounts = $derived(countAvatarIdentities(avatars));
  const rootStyle = $derived(
    [style, `--cinder-avatar-group-overlap: ${normalizedOverlap}`].filter(Boolean).join('; '),
  );

  const visibleAvatars = $derived(
    avatars.slice(0, visibleCount).map((avatar, index) => ({
      avatar,
      key: getAvatarKey(avatar, index, identityCounts),
      trimmedName: (avatar.name ?? '').trim(),
      stackIndex: getVisibleStackIndex(index, visibleCount, zOrder),
    })),
  );

  const overflowStackIndex = $derived(getOverflowStackIndex(visibleCount, zOrder));

  function normalizeMaxVisible(value: number): number {
    if (!Number.isFinite(value)) return defaultMaxVisible;
    return Math.max(0, Math.floor(value));
  }

  function normalizeOverlap(value: string): string {
    const trimmed = value.trim();
    if (/^(?:0|(?:\d*\.)?\d+(?:px|rem|em|ch|ex|vw|vh|vmin|vmax|%))$/.test(trimmed)) {
      return trimmed;
    }
    return '0.75rem';
  }

  function countAvatarIdentities(items: AvatarGroupProps['avatars']): Map<string, number> {
    const counts = new Map<string, number>();
    for (const avatar of items) {
      const identity = avatar.id ?? avatar.name ?? '';
      counts.set(identity, (counts.get(identity) ?? 0) + 1);
    }
    return counts;
  }

  function getAvatarKey(
    avatar: AvatarGroupProps['avatars'][number],
    index: number,
    counts: Map<string, number>,
  ): string {
    const identity = avatar.id ?? avatar.name ?? '';
    return counts.get(identity) === 1 ? identity : `${identity}:${index}`;
  }

  function getVisibleStackIndex(
    index: number,
    count: number,
    order: NonNullable<AvatarGroupProps['zOrder']>,
  ): number {
    if (order === 'first-on-top') return count - index;
    return index + 1;
  }

  function getOverflowStackIndex(
    count: number,
    order: NonNullable<AvatarGroupProps['zOrder']>,
  ): number {
    if (count === 0) return 0;
    if (order === 'first-on-top') return 0;
    return count + 1;
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
  aria-label={label}
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
        <Tooltip text={item.trimmedName} describe={false}>
          <!-- role="img" is the honest semantic: a NAMED composite image, not an
               action control. The trigger only reveals a name tooltip on focus/
               hover — it has no onclick/Enter/Space activation, so role="button"
               would be a false affordance (announces "button" but does nothing →
               WCAG 4.1.2). img takes its name from the author, so aria-label is
               valid here (no aria-prohibited-attr). tabindex="0" on a non-
               interactive role is permitted by ARIA and is purposeful: it gives
               keyboard users the same name-disclosure pointer users get on hover.
               The inner <Avatar> uses alt="" so its image doesn't double-name the
               composite. -->
          <span
            class="cinder-avatar-group__trigger"
            role="img"
            tabindex="0"
            aria-label={item.trimmedName}
          >
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
