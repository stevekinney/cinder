<script lang="ts" module>
  export const title = 'Basic image';
  export const description = 'Responsive image with lazy loading and an explicit aspect ratio.';
</script>

<script lang="ts">
  import { Image } from '@lostgradient/cinder/image';
</script>

<Image
  src="https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=600&q=80"
  alt="Snow-capped mountain peaks at sunrise"
  ratio="16/9"
  width={600}
  height={338}
/>
