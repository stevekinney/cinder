<script lang="ts">
  // Phase 5 of docs/decisions/package-boundaries.md deleted cinder's
  // `@lostgradient/cinder/markdown/*` re-export shims — cinder no longer
  // exposes any markdown subpath. This route now proves the flip side:
  // `@lostgradient/markdown` resolves directly under Vite + the Svelte
  // plugin (the realistic consumer toolchain) as an ordinary sibling
  // dependency, independent of cinder.
  import { computeLineDiff } from '@lostgradient/markdown/diff/line-diff';
  import { isSafeUrl } from '@lostgradient/markdown/utilities/safe-url';
  import { sortKeys } from '@lostgradient/markdown/utilities/sort-keys';
  import { renderMarkdown } from '@lostgradient/markdown/rendering';

  const probes: Array<{ name: string; value: unknown }> = [
    {
      name: '@lostgradient/markdown/diff/line-diff#computeLineDiff',
      value: computeLineDiff,
    },
    { name: '@lostgradient/markdown/utilities/safe-url#isSafeUrl', value: isSafeUrl },
    { name: '@lostgradient/markdown/utilities/sort-keys#sortKeys', value: sortKeys },
    { name: '@lostgradient/markdown/rendering#renderMarkdown', value: renderMarkdown },
  ];
</script>

<main>
  <h1>cinder sveltekit consumer fixture — sibling markdown package imports</h1>
  <ul>
    {#each probes as probe (probe.name)}
      <li data-probe={probe.name}>
        {probe.name}: {typeof probe.value === 'function' ? 'OK' : 'FAIL'}
      </li>
    {/each}
  </ul>
</main>
