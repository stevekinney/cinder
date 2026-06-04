<script lang="ts" module>
  export const title = 'Embedded media composition';
  export const description =
    'Children can fill the box by absolutely positioning themselves inside the relative wrapper.';
</script>

<script lang="ts">
  import { AspectRatio } from '@lostgradient/cinder/aspect-ratio';
</script>

<AspectRatio ratio="4 / 3">
  <div
    style="position: absolute; inset: 0; display: grid; place-items: center; inline-size: 100%; block-size: 100%; border: 1px dashed var(--cinder-border-muted); border-radius: var(--cinder-radius-md); background: repeating-linear-gradient(-45deg, color-mix(in oklch, var(--cinder-border-muted), transparent 82%), color-mix(in oklch, var(--cinder-border-muted), transparent 82%) 0.75rem, color-mix(in oklch, var(--cinder-border-muted), transparent 64%) 0.75rem, color-mix(in oklch, var(--cinder-border-muted), transparent 64%) 1.5rem); color: var(--cinder-text-muted); font: var(--cinder-font-label-md);"
  >
    position: absolute; inset: 0;
  </div>
</AspectRatio>
