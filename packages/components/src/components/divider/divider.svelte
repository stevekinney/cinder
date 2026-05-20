<script lang="ts" module>
  /**
   * @cinder
   * @category layout
   * @status stable
   * @purpose Thin decorative or semantic separator between content regions, with optional vertical orientation and tonal variants.
   * @tag layout
   * @tag separator
   * @useWhen Visually separating sections of a card, list, or toolbar without adding heading-level structure.
   * @useWhen Splitting a row of inline controls (e.g. a button-group toolbar) with a vertical rule.
   * @avoidWhen The split between sections deserves a heading — use section-heading instead.
   * @avoidWhen Wrapping the entire viewport edge — use surface or page-layout instead.
   * @related surface, section-heading
   */
  export type { DividerOrientation, DividerProps, DividerTone } from './divider.types.ts';
</script>

<script lang="ts">
  import { classNames } from '../../utilities/class-names.ts';

  import type { DividerProps } from './divider.types.ts';

  let {
    class: customClassName,
    orientation = 'horizontal',
    inset = false,
    tone = 'subtle',
    decorative = true,
    ...rest
  }: DividerProps = $props();

  const mergedClass = $derived(classNames('cinder-divider', customClassName));
</script>

<!--
  `{...rest}` is spread first so the component's own accessibility/identity
  attributes (aria-hidden, role, aria-orientation, data-cinder-*) win against
  any caller overrides — Svelte 5 attribute order is "last wins."
-->
{#if decorative}
  {#if orientation === 'vertical'}
    <span
      {...rest}
      class={mergedClass}
      aria-hidden="true"
      data-cinder-orientation={orientation}
      data-cinder-tone={tone}
      data-cinder-inset={inset || undefined}
    ></span>
  {:else}
    <div
      {...rest}
      class={mergedClass}
      aria-hidden="true"
      data-cinder-orientation={orientation}
      data-cinder-tone={tone}
      data-cinder-inset={inset || undefined}
    ></div>
  {/if}
{:else if orientation === 'vertical'}
  <span
    {...rest}
    class={mergedClass}
    role="separator"
    aria-orientation="vertical"
    data-cinder-orientation={orientation}
    data-cinder-tone={tone}
    data-cinder-inset={inset || undefined}
  ></span>
{:else}
  <hr
    {...rest}
    class={mergedClass}
    data-cinder-orientation={orientation}
    data-cinder-tone={tone}
    data-cinder-inset={inset || undefined}
  />
{/if}
