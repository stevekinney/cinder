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

<!--
  Branching by selectionMode narrows the SegmentedControlProps discriminated
  union for `svelte-check`. Each branch can resolve `value` to the right type
  (string for single, SvelteSet for multiple) without a cast at the spread
  site.
-->
{#snippet segments()}
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
{/snippet}

{#if selectionMode === 'multiple'}
  <SegmentedControl
    {id}
    {label}
    selectionMode="multiple"
    bind:value={value as SvelteSet<string> | undefined}
    variant={variant === 'tablist' ? undefined : variant}
    {size}
    {density}
    {orientation}
    {detached}
    {fullWidth}
    {hideLabel}
    {disabled}
    {onchange}
    class={className}
    {...rest}
  >
    {@render segments()}
  </SegmentedControl>
{:else}
  <SegmentedControl
    {id}
    {label}
    selectionMode="single"
    bind:value={value as string | undefined}
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
    {@render segments()}
  </SegmentedControl>
{/if}
