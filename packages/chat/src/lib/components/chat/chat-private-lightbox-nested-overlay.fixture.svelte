<script lang="ts" module>
  export const title = 'Lightbox nested in Drawer';
  export const description =
    'Regression harness for CIN-377: an ImageLightbox opened from inside a Drawer, ' +
    'verifying Escape dismisses only the top-most overlay (the shared LIFO escape ' +
    'stack) and page scroll state is correct after close in both dismissal orders.';
</script>

<script lang="ts">
  import { Button } from '@lostgradient/cinder/button';
  import { Drawer } from '@lostgradient/cinder/drawer';
  import ImageLightbox from './message/image-lightbox.svelte';

  let drawerOpen = $state(false);
  let lightboxOpen = $state(false);
  let drawerTriggerRef: HTMLElement | null = $state(null);

  const images = [
    { src: 'https://placehold.co/400x300', alt: 'First image' },
    { src: 'https://placehold.co/400x300/222/fff', alt: 'Second image' },
  ];
</script>

<div data-testid="lightbox-nested-overlay-harness">
  <Button
    label="Open drawer"
    onclick={(event) => {
      drawerTriggerRef = event.currentTarget as HTMLElement;
      drawerOpen = true;
    }}
  />

  <Drawer bind:open={drawerOpen} title="Attachments" triggerRef={drawerTriggerRef}>
    <p>A drawer hosting an attachment that opens the image lightbox on top of it.</p>
    <Button
      label="Open image"
      data-testid="open-lightbox"
      onclick={() => {
        lightboxOpen = true;
      }}
    />
  </Drawer>

  <ImageLightbox {images} bind:open={lightboxOpen} />
</div>
