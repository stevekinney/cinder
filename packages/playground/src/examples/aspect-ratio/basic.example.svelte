<script lang="ts" module>
  export const title = 'Basic 16:9 media box';
  export const description = 'The default ratio reserves a responsive widescreen box.';
</script>

<script lang="ts">
  import { AspectRatio } from 'cinder/aspect-ratio';
</script>

<AspectRatio>
  <div
    style="display: grid; place-items: center; inline-size: 100%; block-size: 100%; border: 1px dashed var(--cinder-border-muted); border-radius: var(--cinder-radius-md); background: linear-gradient(135deg, color-mix(in oklch, var(--cinder-accent), transparent 84%), color-mix(in oklch, var(--cinder-color-info-bg), transparent 20%)); color: var(--cinder-text); font: var(--cinder-font-label-md);"
  >
    16:9
  </div>
</AspectRatio>
