<script lang="ts">
  // PR 1: smoke-test that every cinder/<pkg>/<subpath> resolves through the
  // published tarball under Vite + the Svelte plugin (the realistic consumer
  // toolchain). One representative named export per upstream package keeps
  // the bundle reachability check meaningful without recompiling every
  // upstream symbol.
  import { computeLineDiff as computeLineDiffViaDiff } from 'cinder/diff/line-diff';
  import { isSafeUrl } from 'cinder/markdown/utilities/safe-url';
  import { sortKeys } from 'cinder/markdown/utilities/sort-keys';
  import { renderMarkdown } from 'cinder/markdown/rendering';

  const probes: Array<{ name: string; value: unknown }> = [
    { name: 'cinder/diff/line-diff#computeLineDiff', value: computeLineDiffViaDiff },
    { name: 'cinder/markdown/utilities/safe-url#isSafeUrl', value: isSafeUrl },
    { name: 'cinder/markdown/utilities/sort-keys#sortKeys', value: sortKeys },
    { name: 'cinder/markdown/rendering#renderMarkdown', value: renderMarkdown },
  ];
</script>

<main>
  <h1>cinder sveltekit consumer fixture — upstream subpath imports</h1>
  <ul>
    {#each probes as probe (probe.name)}
      <li data-probe={probe.name}>
        {probe.name}: {typeof probe.value === 'function' ? 'OK' : 'FAIL'}
      </li>
    {/each}
  </ul>
</main>
