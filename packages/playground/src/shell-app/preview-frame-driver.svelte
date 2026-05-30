<script lang="ts" module>
  export type PreviewFrameDriverProps = {
    /** Component name the preview frame starts on. */
    initial: string;
  };

  export type PreviewFrameDriverHandle = {
    setComponentName(next: string): void;
    /** Reload the framed document (exercises the live-reload overlay path). */
    reload(): void;
  };
</script>

<script lang="ts">
  import PreviewFrame, { type PreviewFrameHandle } from './preview-frame.svelte';
  import { PreviewStore, setPreviewStore } from './preview-store.svelte.ts';

  let { initial }: PreviewFrameDriverProps = $props();

  // Install a store in this tree so `getPreviewStore()` inside PreviewFrame
  // resolves. The driver is the component-tree owner of the context.
  setPreviewStore(new PreviewStore(initial));

  let componentName = $state<string>(initial);
  let frame = $state<PreviewFrameHandle | null>(null);

  /** Imperative handle the test holds onto to drive sidebar navigation. */
  export function setComponentName(next: string): void {
    componentName = next;
  }

  /** Forward a live-reload to the framed preview, re-arming its overlay. */
  export function reload(): void {
    frame?.reload();
  }
</script>

<PreviewFrame bind:this={frame} {componentName} />
