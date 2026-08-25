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

  // Inline SVG data URIs — no external network dependency for the browser
  // suite. Same pattern as `playground/src/examples/image/basic.example.svelte`
  // and `carousel/basic.example.svelte`: a self-contained `data:image/svg+xml,`
  // URL-encoded rect, one per image so the two are visually distinguishable.
  const images = [
    {
      src: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='300'%3E%3Crect width='400' height='300' fill='%234a90d9'/%3E%3C/svg%3E",
      alt: 'First image',
    },
    {
      src: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='300'%3E%3Crect width='400' height='300' fill='%23222222'/%3E%3C/svg%3E",
      alt: 'Second image',
    },
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

    <!--
      Rendered INSIDE the Drawer's content, not as a sibling after
      `</Drawer>` — real `MessageAttachments` renders its ImageLightbox
      within its own subtree, so the Drawer panel must be a genuine DOM
      ancestor of the lightbox for this harness to exercise the production
      nesting it claims to: ancestor `inert` state and focus-containment
      behavior (especially during the drawer-first close order) only show
      up when the lightbox is a real descendant, not a sibling.
    -->
    <ImageLightbox {images} bind:open={lightboxOpen} />
  </Drawer>
</div>
