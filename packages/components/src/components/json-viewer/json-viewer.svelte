<script lang="ts" module>
  /**
   * @cinder
   * @category data-display
   * @status stable
   * @purpose Collapsible tree visualization of an arbitrary JSON value with hard depth and byte caps and a fallback for oversized payloads.
   * @tag json
   * @tag inspector
   * @tag tree
   * @useWhen Inspecting structured API responses, debug payloads, or configuration documents inside an admin or developer surface.
   * @useWhen Rendering a JSON-serializable value with predictable initial-collapse behavior and no virtualization needs.
   * @avoidWhen The payload is large enough to need search, filter, or virtualization — compose a custom viewer instead.
   * @avoidWhen Showing arbitrary source code rather than a JSON value — code-block is the right surface for that.
   * @related code-block, tree
   */
  export type { JsonViewerProps } from './json-viewer.types.ts';
</script>

<script lang="ts">
  import type { JsonViewerProps } from './json-viewer.types.ts';
  import JsonViewerNode from './_json-viewer-node.svelte';
  import { classNames } from '../../utilities/class-names.ts';

  let {
    value,
    initialDepth = 1,
    maxDepth = 50,
    maxBytes = 1_048_576,
    class: className,
  }: JsonViewerProps = $props();

  // Compute serialized size up front so we can short-circuit oversized payloads
  // before walking the tree. `JSON.stringify` can throw (circular references) or
  // throw on `BigInt`; distinguish that from "too large" so the fallback shows a
  // meaningful message instead of a garbage "~Infinity KB" size.
  const serialized = $derived.by((): { ok: true; size: number } | { ok: false } => {
    try {
      const json = JSON.stringify(value);
      // `JSON.stringify` returns `undefined` (not a throw) for top-level
      // `undefined`, a `Symbol`, or a function — none of which are valid JSON.
      // Treat those as unserializable rather than measuring the string "undefined".
      if (typeof json !== 'string') return { ok: false };
      return { ok: true, size: new Blob([json]).size };
    } catch {
      return { ok: false };
    }
  });

  const unserializable = $derived(!serialized.ok);
  const tooLarge = $derived(serialized.ok && serialized.size > maxBytes);

  function handleTreeKeydown(event: KeyboardEvent): void {
    const tree = event.currentTarget as HTMLElement;
    const items = Array.from(tree.querySelectorAll<HTMLElement>('[role="treeitem"]'));
    const eventTarget = event.target instanceof HTMLElement ? event.target : null;
    const current = eventTarget?.closest<HTMLElement>('[role="treeitem"]') ?? null;
    const targetIsToggle = eventTarget?.closest('.cinder-json-viewer__toggle') !== null;
    const currentIndex = current ? items.indexOf(current) : -1;

    function focusItem(index: number): void {
      const item = items[index];
      item?.focus();
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      focusItem(Math.min(currentIndex + 1, items.length - 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      focusItem(Math.max(currentIndex - 1, 0));
    } else if (event.key === 'Home') {
      event.preventDefault();
      focusItem(0);
    } else if (event.key === 'End') {
      event.preventDefault();
      focusItem(items.length - 1);
    } else if (event.key === 'ArrowRight' && current && !targetIsToggle) {
      if (current.getAttribute('aria-expanded') === 'false') {
        event.preventDefault();
        current.querySelector<HTMLButtonElement>('.cinder-json-viewer__toggle')?.click();
      } else if (current.getAttribute('aria-expanded') === 'true') {
        const firstChild = current.querySelector<HTMLElement>(
          '.cinder-json-viewer__children [role="treeitem"]',
        );
        if (firstChild) {
          event.preventDefault();
          firstChild.focus();
        }
      }
    } else if (event.key === 'ArrowLeft' && current && !targetIsToggle) {
      if (current.getAttribute('aria-expanded') === 'true') {
        event.preventDefault();
        current.querySelector<HTMLButtonElement>('.cinder-json-viewer__toggle')?.click();
      } else {
        const parent = current.parentElement?.closest<HTMLElement>('[role="treeitem"]');
        if (parent) {
          event.preventDefault();
          parent.focus();
        }
      }
    } else if (
      (event.key === 'Enter' || event.key === ' ' || event.key === 'Spacebar') &&
      current &&
      !targetIsToggle
    ) {
      event.preventDefault();
      const toggle = current.querySelector<HTMLButtonElement>('.cinder-json-viewer__toggle');
      toggle?.click();
    }
  }
</script>

<div class={classNames('cinder-json-viewer', className)}>
  {#if unserializable}
    <div class="cinder-json-viewer__fallback" role="status">
      <p>
        This value can't be serialized as JSON (it may contain a circular reference or a BigInt).
      </p>
      <p>Pass a plain JSON-serializable value, or use the consumer's download or copy action.</p>
    </div>
  {:else if tooLarge}
    <div class="cinder-json-viewer__fallback" role="status">
      <p>
        Payload too large to render (~{Math.round((serialized.ok ? serialized.size : 0) / 1024)} KB; cap
        is {Math.round(maxBytes / 1024)} KB).
      </p>
      <p>Use the consumer's download or copy action to inspect the raw JSON.</p>
    </div>
  {:else}
    <div role="tree" aria-label="JSON tree" tabindex="-1" onkeydown={handleTreeKeydown}>
      <JsonViewerNode {value} depth={0} {initialDepth} {maxDepth} position={1} setSize={1} root />
    </div>
  {/if}
</div>
