# FindBar

Docked find-in-document controls for a host-provided search backend.

## Usage

```svelte
<script lang="ts">
  import { FindBar } from '@lostgradient/cinder/find-bar';

  const documents = ['Terminal output', 'Terminal settings', 'Build logs', 'Command history'];
  let open = $state(true);
  let query = $state('terminal');
  let matches = $state(documents.filter((document) => document.toLowerCase().includes(query)));
  let activeIndex = $state(0);

  function search(nextQuery: string) {
    query = nextQuery;
    matches = documents.filter((document) => document.toLowerCase().includes(query.toLowerCase()));
    activeIndex = 0;
  }
</script>

{#if open}
  <FindBar
    bind:value={query}
    bind:activeIndex
    matchCount={matches.length}
    onQueryChange={search}
    onPrevious={() => (activeIndex = (activeIndex - 1 + matches.length) % matches.length)}
    onNext={() => (activeIndex = (activeIndex + 1) % matches.length)}
    onDismiss={() => (open = false)}
  />
{/if}
```
