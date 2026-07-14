<script lang="ts" module>
  import type { SvelteSet } from 'svelte/reactivity';

  type FixtureOptionBase = {
    label: string;
    current?: boolean;
    currentToken?: 'page' | 'step' | 'location' | 'date' | 'time' | 'true';
    onclick?: (event: MouseEvent) => void;
    disabled?: boolean;
    controls?: string;
  };

  export type FixtureOption = FixtureOptionBase &
    ({ value: string; href?: string } | { href: string; value?: string });

  export type FixtureProps = {
    id: string;
    label: string;
    name?: string;
    options: readonly FixtureOption[];
    selectionMode?: 'single' | 'multiple';
    value?: string | SvelteSet<string> | undefined;
    onValueChange?: (next: string | SvelteSet<string> | undefined) => void;
    onchange?: (value: string) => void;
    variant?: 'radiogroup' | 'tablist' | 'navigation';
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
  import { untrack } from 'svelte';
  import Segment from '../../components/segment/segment.svelte';
  import SegmentedControl from '../../components/segmented-control/segmented-control.svelte';

  let {
    id,
    label,
    name,
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

  void untrack(() => onValueChange);
</script>

<!--
  Branching by selectionMode narrows the SegmentedControlProps discriminated
  union for `svelte-check`. Each branch can resolve `value` to the right type
  (string for single, SvelteSet for multiple) without a cast at the spread
  site.
-->
{#snippet segments()}
  {#each options as option (option.value ?? option.href ?? option.label)}
    {#if option.href !== undefined}
      <Segment
        value={option.value}
        href={option.href}
        current={option.current}
        currentToken={option.currentToken}
        disabled={option.disabled}
        onclick={option.onclick}
      >
        {option.label}
      </Segment>
    {:else if showLeadingIcon}
      <Segment
        value={option.value ?? option.href ?? ''}
        disabled={option.disabled}
        controls={option.controls}
      >
        {#snippet leading()}<span data-test-icon></span>{/snippet}
        {option.label}
      </Segment>
    {:else}
      <Segment
        value={option.value ?? option.href ?? ''}
        disabled={option.disabled}
        controls={option.controls}
      >
        {option.label}
      </Segment>
    {/if}
  {/each}
{/snippet}

{#if selectionMode === 'multiple'}
  <SegmentedControl
    {id}
    {label}
    {name}
    selectionMode="multiple"
    bind:value={value as SvelteSet<string> | undefined}
    variant={variant as 'radiogroup' | undefined}
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
    {name}
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
