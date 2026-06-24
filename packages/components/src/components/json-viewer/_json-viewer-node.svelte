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
    position: number;
    setSize: number;
    root?: boolean;
  };
</script>

<script lang="ts">
  import { untrack } from 'svelte';
  import Self from './_json-viewer-node.svelte';
  import { classNames } from '../../utilities/class-names.ts';

  let {
    value,
    keyName,
    depth,
    initialDepth,
    maxDepth,
    position,
    setSize,
    root = false,
  }: JsonViewerNodeProps = $props();

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

  // The key label renders inside the <button> so the focus ring encloses the
  // full row label + caret. The aria-label on the button provides a distinguishing
  // accessible name from the key (when present) and the collection shape so
  // sibling toggles are tellable apart.
  const itemCount = $derived(entries.length);
  const collectionLabel = $derived(
    `${isArray ? 'array' : 'object'}, ${itemCount} ${itemCount === 1 ? 'item' : 'items'}`,
  );
  const toggleLabel = $derived(
    keyName === undefined ? collectionLabel : `${keyName}: ${collectionLabel}`,
  );

  function valueClass(v: unknown): string {
    if (v === null) return 'null';
    if (typeof v === 'string') return 'string';
    if (typeof v === 'number') return 'number';
    if (typeof v === 'boolean') return 'boolean';
    return 'unknown';
  }
</script>

{#if isObject && !tooDeep}
  <span class={classNames('cinder-json-viewer__node')}>
    <button
      type="button"
      class="cinder-json-viewer__toggle"
      role="treeitem"
      aria-expanded={!collapsed}
      aria-label={toggleLabel}
      aria-level={depth + 1}
      aria-posinset={position}
      aria-setsize={setSize}
      onclick={() => (collapsed = !collapsed)}
    >
      {#if keyName !== undefined}
        <span class="cinder-json-viewer__key">{keyName}:</span>
      {/if}
      <span class="cinder-json-viewer__caret" data-cinder-collapsed={collapsed || undefined}></span>
      <span class="cinder-json-viewer__brace">
        {isArray ? '[' : '{'}
      </span>
      {#if collapsed}
        <span class="cinder-json-viewer__summary"
          >{itemCount} {itemCount === 1 ? 'item' : 'items'}</span
        >
        <span class="cinder-json-viewer__brace">{isArray ? ']' : '}'}</span>
      {/if}
    </button>
    {#if !collapsed}
      <ul class="cinder-json-viewer__children" role="group">
        <!--
          For objects `k` is the property name — a stable, correct key. For arrays
          `k` is the index: JSON array elements carry no intrinsic identity, so if
          the consumer swaps in a different array each child's collapsed $state
          stays associated with its position rather than its value. This is an
          accepted tradeoff given arrays have no stable per-item key.
        -->
        {#each entries as [k, v], index (k)}
          <li role="none">
            <Self
              value={v}
              keyName={k}
              depth={depth + 1}
              {initialDepth}
              {maxDepth}
              position={index + 1}
              setSize={entries.length}
            />
          </li>
        {/each}
      </ul>
      <span class="cinder-json-viewer__brace">{isArray ? ']' : '}'}</span>
    {/if}
  </span>
{:else if isObject && tooDeep}
  <span
    class="cinder-json-viewer__node"
    role="treeitem"
    tabindex={root ? 0 : -1}
    aria-level={depth + 1}
    aria-posinset={position}
    aria-setsize={setSize}
  >
    {#if keyName !== undefined}
      <span class="cinder-json-viewer__key">{keyName}:</span>
    {/if}
    <span class="cinder-json-viewer__too-deep">…</span>
  </span>
{:else}
  <span
    class="cinder-json-viewer__node"
    role="treeitem"
    tabindex={root ? 0 : -1}
    aria-level={depth + 1}
    aria-posinset={position}
    aria-setsize={setSize}
  >
    {#if keyName !== undefined}
      <span class="cinder-json-viewer__key">{keyName}:</span>
    {/if}
    <span class="cinder-json-viewer__value" data-cinder-type={valueClass(value)}>
      {#if typeof value === 'string'}"{value}"{:else}{String(value)}{/if}
    </span>
  </span>
{/if}
