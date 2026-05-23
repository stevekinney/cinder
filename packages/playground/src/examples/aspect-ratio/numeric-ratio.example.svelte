<script lang="ts" module>
  export const title = 'Numeric 4:3 ratio';
  export const description =
    'Finite numeric values serialize directly onto the native CSS property.';
</script>

<script lang="ts">
  import { AspectRatio } from 'cinder/aspect-ratio';
</script>

<AspectRatio ratio={4 / 3}>
  <div
    style="display: grid; place-items: center; inline-size: 100%; block-size: 100%; border: 1px dashed var(--cinder-border-muted); border-radius: var(--cinder-radius-md); background: linear-gradient(180deg, color-mix(in oklch, var(--cinder-color-success-bg), transparent 5%), color-mix(in oklch, var(--cinder-surface-raised), transparent 0%)); color: var(--cinder-color-success-fg); font: var(--cinder-font-label-md);"
  >
    4 / 3
  </div>
</AspectRatio>
