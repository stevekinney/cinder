<script lang="ts" module>
  /**
   * Internal recursive node for JsonViewer. Not part of the public API;
   * consumers import JsonViewer directly.
   */
  export type JsonViewerNodeProps = {
    value: unknown;
    keyName?: string | number;
    depth: number;
    initialDepth: number;
    maxDepth: number;
  };
</script>

<script lang="ts">
  import { untrack } from 'svelte';
  import Self from './_json-viewer-node.svelte';
  import { cn } from '../../utilities/class-names.ts';

  let { value, keyName, depth, initialDepth, maxDepth }: JsonViewerNodeProps = $props();

  const isObject = $derived(value !== null && typeof value === 'object');
  const isArray = $derived(Array.isArray(value));
  const tooDeep = $derived(depth >= maxDepth);

  // Seeded once from the initial depth vs. the configured initialDepth.
  let collapsed = $state(untrack(() => depth >= initialDepth));

  const entries = $derived.by(() => {
    if (!isObject || tooDeep) return [];
    if (isArray) {
      return (value as unknown[]).map((item, i) => [i, item] as const);
    }
    return Object.entries(value as Record<string, unknown>);
  });

  function valueClass(v: unknown): string {
    if (v === null) return 'null';
    if (typeof v === 'string') return 'string';
    if (typeof v === 'number') return 'number';
    if (typeof v === 'boolean') return 'boolean';
    return 'unknown';
  }
</script>

{#if isObject && !tooDeep}
  <span class={cn('cinder-json-viewer__node')}>
    {#if keyName !== undefined}
      <span class="cinder-json-viewer__key">{keyName}:</span>
    {/if}
    <button
      type="button"
      class="cinder-json-viewer__toggle"
      aria-expanded={!collapsed}
      onclick={() => (collapsed = !collapsed)}
    >
      <span class="cinder-json-viewer__caret" data-cinder-collapsed={collapsed || undefined}></span>
      <span class="cinder-json-viewer__brace">
        {isArray ? '[' : '{'}
      </span>
      {#if collapsed}
        <span class="cinder-json-viewer__summary">{entries.length} items</span>
        <span class="cinder-json-viewer__brace">{isArray ? ']' : '}'}</span>
      {/if}
    </button>
    {#if !collapsed}
      <ul class="cinder-json-viewer__children">
        {#each entries as [k, v] (k)}
          <li>
            <Self value={v} keyName={k} depth={depth + 1} {initialDepth} {maxDepth} />
          </li>
        {/each}
      </ul>
      <span class="cinder-json-viewer__brace">{isArray ? ']' : '}'}</span>
    {/if}
  </span>
{:else if isObject && tooDeep}
  <span class="cinder-json-viewer__node">
    {#if keyName !== undefined}
      <span class="cinder-json-viewer__key">{keyName}:</span>
    {/if}
    <span class="cinder-json-viewer__too-deep">…</span>
  </span>
{:else}
  <span class="cinder-json-viewer__node">
    {#if keyName !== undefined}
      <span class="cinder-json-viewer__key">{keyName}:</span>
    {/if}
    <span class="cinder-json-viewer__value" data-cinder-type={valueClass(value)}>
      {#if typeof value === 'string'}"{value}"{:else}{String(value)}{/if}
    </span>
  </span>
{/if}
