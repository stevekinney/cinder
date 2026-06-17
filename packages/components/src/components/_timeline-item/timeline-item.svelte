<script lang="ts" module>
  /**
   * @cinder
   * @category data-display
   * @status stable
   * @purpose Single event inside a timeline rail with a decorative tone marker, timestamp-first header, optional group header, and body content.
   * @tag timeline
   * @tag event
   * @useWhen Rendering one event along a timeline rail with consistent marker, header, connector, and body structure.
   * @useWhen Coloring decorative markers by tone (info, success, warning, error) while keeping the meaningful status in title or content.
   * @avoidWhen The entry lives in a social activity stream rather than a workflow rail — feed-event fits better.
   * @related timeline, feed-event
   */
  export type { TimelineItemProps } from './timeline-item.types.ts';
</script>

<script lang="ts">
  import { classNames } from '../../utilities/class-names.ts';
  import type { TimelineHeadingLevel } from '../timeline/timeline.types.ts';
  import type { TimelineItemProps } from './timeline-item.types.ts';

  let {
    datetime,
    timestamp,
    title,
    tone = 'info',
    connectorAfter = 'visible',
    groupHeader,
    groupHeaderLevel = 3,
    class: className,
    children,
    marker,
    ...rest
  }: TimelineItemProps = $props();

  // Render a native h1–h6 rather than `<div role="heading">`. Native headings
  // carry stronger, more widely supported semantics (outline navigation, implicit
  // level) and match the codebase pattern in section-heading and form-section.
  // Coerce + clamp at runtime: JS/schema-driven callers can pass 0/7/NaN, which
  // would emit invalid <h0>/<hNaN>. Matches card.svelte and empty-state.svelte.
  const resolvedGroupHeaderLevel = $derived(
    Number.isFinite(Math.trunc(Number(groupHeaderLevel)))
      ? Math.min(6, Math.max(1, Math.trunc(Number(groupHeaderLevel))))
      : 3,
  );
  const groupHeaderTag = $derived(`h${resolvedGroupHeaderLevel}` as `h${TimelineHeadingLevel}`);
</script>

<li
  {...rest}
  class={classNames('cinder-timeline-item', className)}
  data-cinder-tone={tone}
  data-cinder-connector-after={connectorAfter}
>
  {#if groupHeader}
    <svelte:element this={groupHeaderTag} class="cinder-timeline__group-header">
      {groupHeader}
    </svelte:element>
  {/if}
  <div class="cinder-timeline-item__event">
    <span class="cinder-timeline-item__marker" aria-hidden="true" inert>
      {#if marker}
        {@render marker()}
      {/if}
    </span>
    <div class="cinder-timeline-item__content">
      <header class="cinder-timeline-item__header">
        <time class="cinder-timeline-item__time" {datetime}>{timestamp}</time>
        <span class="cinder-timeline-item__title">{title}</span>
      </header>
      {#if children}
        <div class="cinder-timeline-item__body">{@render children()}</div>
      {/if}
    </div>
  </div>
</li>
