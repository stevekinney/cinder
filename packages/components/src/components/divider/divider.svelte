<script lang="ts" module>
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

{#if decorative}
  {#if orientation === 'vertical'}
    <span
      class={mergedClass}
      aria-hidden="true"
      data-cinder-orientation={orientation}
      data-cinder-tone={tone}
      data-cinder-inset={inset || undefined}
      {...rest}
    ></span>
  {:else}
    <div
      class={mergedClass}
      aria-hidden="true"
      data-cinder-orientation={orientation}
      data-cinder-tone={tone}
      data-cinder-inset={inset || undefined}
      {...rest}
    ></div>
  {/if}
{:else if orientation === 'vertical'}
  <span
    class={mergedClass}
    role="separator"
    aria-orientation="vertical"
    data-cinder-orientation={orientation}
    data-cinder-tone={tone}
    data-cinder-inset={inset || undefined}
    {...rest}
  ></span>
{:else}
  <hr
    class={mergedClass}
    data-cinder-orientation={orientation}
    data-cinder-tone={tone}
    data-cinder-inset={inset || undefined}
    {...rest}
  />
{/if}
