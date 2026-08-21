<script lang="ts" module>
  export const title = 'Basic image';
  export const description = 'Responsive image with lazy loading and an explicit aspect ratio.';
</script>

<script lang="ts">
  import { Image } from '@lostgradient/cinder/image';

  const imageSource =
    "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='600' height='338' viewBox='0 0 600 338' fill='currentColor'%3E%3Crect width='600' height='338' opacity='.92'/%3E%3Cpath d='M0 260 150 120l100 90 90-70 260 198H0Z' opacity='.62'/%3E%3Ccircle cx='455' cy='92' r='34' opacity='.32'/%3E%3C/svg%3E";
</script>

<Image
  src={imageSource}
  alt="A blue illustration of mountains beneath a yellow sun"
  ratio="16/9"
  width={600}
  height={338}
/>
