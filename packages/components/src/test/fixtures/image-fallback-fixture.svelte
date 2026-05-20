<script lang="ts" module>
  /**
   * Test fixture that wraps Image with a fallback snippet. Used to verify the
   * error → fallback rendering path.
   */
  export type ImageFallbackFixtureProps = {
    src: string;
    alt: string;
    ratio?: string;
  };
</script>

<script lang="ts">
  import Image from '../../components/image/image.svelte';

  let { src, alt, ratio }: ImageFallbackFixtureProps = $props();

  const ratioProps = $derived(ratio !== undefined ? { ratio } : {});
</script>

<Image {src} {alt} {...ratioProps}>
  {#snippet fallback()}
    <span data-testid="image-fallback">Could not load image</span>
  {/snippet}
</Image>
