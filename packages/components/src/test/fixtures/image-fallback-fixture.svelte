<script lang="ts" module>
  /**
   * Test fixture that wraps Image with a fallback snippet. Used to verify the
   * error → fallback rendering path.
   */
  export type ImageFallbackFixtureProps = {
    src: string;
    alt: string;
  };
</script>

<script lang="ts">
  import Image from '../../components/image.svelte';

  let { src, alt }: ImageFallbackFixtureProps = $props();
</script>

<Image {src} {alt}>
  {#snippet fallback()}
    <span data-testid="image-fallback">Could not load image</span>
  {/snippet}
</Image>
