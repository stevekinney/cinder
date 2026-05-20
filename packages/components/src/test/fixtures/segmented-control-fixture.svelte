<script lang="ts" module>
  import type { SvelteSet } from 'svelte/reactivity';

  export type FixtureOption = {
    value: string;
    label: string;
    disabled?: boolean;
    controls?: string;
  };

  export type FixtureProps = {
    id: string;
    label: string;
    options: readonly FixtureOption[];
    selectionMode?: 'single' | 'multiple';
    value?: string | SvelteSet<string> | undefined;
    onValueChange?: (next: string | SvelteSet<string> | undefined) => void;
    onchange?: (value: string) => void;
    variant?: 'radiogroup' | 'tablist';
    size?: 'sm' | 'md' | 'lg';
    density?: 'toolbar';
    orientation?: 'horizontal' | 'vertical';
    detached?: boolean;
    fullWidth?: boolean;
    hideLabel?: boolean;
    disabled?: boolean;
    disallowEmptySelection?: boolean;
    className?: string;
    showLeadingIcon?: boolean;
    rest?: Record<string, unknown>;
  };
</script>

<script lang="ts">
  import Segment from '../../components/segment/segment.svelte';
  import SegmentedControl from '../../components/segmented-control/segmented-control.svelte';

  let {
    id,
    label,
    options,
    selectionMode = 'single',
    value = $bindable(),
    onValueChange,
    onchange,
    variant,
    size,
    density,
    orientation,
    detached,
    fullWidth,
    hideLabel,
    disabled,
    disallowEmptySelection,
    className,
    showLeadingIcon = false,
    rest = {},
  }: FixtureProps = $props();

  void onValueChange;
</script>

<SegmentedControl
  {id}
  {label}
  {selectionMode}
  bind:value
  {variant}
  {size}
  {density}
  {orientation}
  {detached}
  {fullWidth}
  {hideLabel}
  {disabled}
  {disallowEmptySelection}
  {onchange}
  class={className}
  {...rest}
>
  {#each options as option (option.value)}
    {#if showLeadingIcon}
      <Segment value={option.value} disabled={option.disabled} controls={option.controls}>
        {#snippet leading()}<span data-test-icon></span>{/snippet}
        {option.label}
      </Segment>
    {:else}
      <Segment value={option.value} disabled={option.disabled} controls={option.controls}>
        {option.label}
      </Segment>
    {/if}
  {/each}
</SegmentedControl>
