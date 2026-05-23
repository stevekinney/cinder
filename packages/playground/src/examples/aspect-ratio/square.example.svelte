<script lang="ts" module>
  export const title = 'Square ratio';
  export const description =
    'String ratios pass through unchanged, including human-readable forms like 1 / 1.';
</script>

<script lang="ts">
  import { AspectRatio } from 'cinder/aspect-ratio';
</script>

<AspectRatio ratio="1 / 1">
  <div
    style="display: grid; place-items: center; inline-size: 100%; block-size: 100%; border: 1px dashed var(--cinder-border-muted); border-radius: 999px; background: radial-gradient(circle at 30% 30%, color-mix(in oklch, var(--cinder-accent), white 72%), color-mix(in oklch, var(--cinder-accent), transparent 18%)); color: var(--cinder-text); font: var(--cinder-font-label-md);"
  >
    1 / 1
  </div>
</AspectRatio>
