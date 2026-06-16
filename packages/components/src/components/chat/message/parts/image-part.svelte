<script lang="ts" module>
  import type { ImageMessagePart } from '../../utilities/types.ts';

  export type ImagePartProps = {
    /**
     * The contiguous run of image parts to render as one attachment group.
     *
     * Images are grouped rather than rendered one-per-component because the
     * attachment grid lays out by total count (`data-count`): one image is
     * centered, two sit side by side, three or more flow in an auto-fit grid.
     * Splitting them into independent single-image components would each render
     * with count 1 and break that layout — so the renderer collects adjacent
     * image parts and hands the whole run here.
     */
    parts: ImageMessagePart[];
  };
</script>

<script lang="ts">
  import MessageAttachments from '../message-attachments.svelte';

  let { parts }: ImagePartProps = $props();

  const images = $derived(parts.map((part) => part.image));
</script>

<MessageAttachments {images} />
