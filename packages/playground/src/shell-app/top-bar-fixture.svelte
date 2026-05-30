<script lang="ts" module>
  import type { PreviewStore } from './preview-store.svelte.ts';

  export type TopBarFixtureProps = {
    /**
     * The store instance to install on the context before mounting the bar.
     * When omitted, the fixture constructs one seeded with `currentComponent`.
     */
    store?: PreviewStore;
    /**
     * Seed value for the store's `currentComponent` when no `store` is passed.
     * Lets tests that only care about the selected component name render the
     * bar without constructing a store themselves.
     */
    currentComponent?: string;
  };
</script>

<script lang="ts">
  import Announcer from './announcer.svelte';
  import { Announcer as AnnouncerStore, setAnnouncer } from './announcer.svelte.ts';
  import { PreviewStore as PreviewStoreClass, setPreviewStore } from './preview-store.svelte.ts';
  import TopBar from './top-bar.svelte';

  let { store, currentComponent = '' }: TopBarFixtureProps = $props();

  // top-bar.svelte reads the store via `getPreviewStore()` and the announcer via
  // `getAnnouncer()`, both of which throw if nothing is installed on the
  // context. Install a store (the caller's, or one seeded from currentComponent)
  // and a real Announcer before mounting — mirroring how `shell.svelte` wires
  // the real shell — and render the Announcer's single live region so tests can
  // observe announcements.
  const resolvedStore = store ?? new PreviewStoreClass(currentComponent);
  setPreviewStore(resolvedStore);

  const announcer = new AnnouncerStore();
  setAnnouncer(announcer);
</script>

<TopBar />
<Announcer />
