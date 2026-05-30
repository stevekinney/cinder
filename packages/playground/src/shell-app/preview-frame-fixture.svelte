<script lang="ts" module>
  import type { PreviewStore } from './preview-store.svelte.ts';

  export type PreviewFrameFixtureProps = {
    /** The store instance to install on the context before mounting the frame. */
    store: PreviewStore;
    /** Component name forwarded to `preview-frame.svelte`. */
    componentName: string;
  };
</script>

<script lang="ts">
  import { setPreviewStore } from './preview-store.svelte.ts';
  import PreviewFrame from './preview-frame.svelte';

  let { store, componentName }: PreviewFrameFixtureProps = $props();

  // preview-frame.svelte reads the store via `getPreviewStore()`, which throws
  // if no store is installed on the context. Install the test's store first.
  setPreviewStore(store);
</script>

<PreviewFrame {componentName} />
