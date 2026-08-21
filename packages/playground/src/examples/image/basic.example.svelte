<script lang="ts" module>
  export const title = 'Basic image';
  export const description = 'Responsive image with lazy loading and an explicit aspect ratio.';
</script>

<script lang="ts">
  import { Image } from '@lostgradient/cinder/image';

  const imageSource =
    "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='600' height='338' viewBox='0 0 600 338'%3E%3Crect width='600' height='338' fill='currentColor' opacity='.15'/%3E%3Cpath d='M0 260 150 120l100 90 90-70 260 198H0Z' fill='currentColor' opacity='.7'/%3E%3Ccircle cx='455' cy='92' r='34' fill='currentColor'/%3E%3C/svg%3E";
</script>

<Image
  src={imageSource}
  alt="An illustration of mountains beneath a sun"
  ratio="16/9"
  width={600}
  height={338}
/>
