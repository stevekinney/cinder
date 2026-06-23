<script lang="ts" module>
  export const title = 'Basic image';
  export const description = 'Responsive image with lazy loading and an explicit aspect ratio.';
</script>

<script lang="ts">
  import { Image } from '@lostgradient/cinder/image';
</script>

<Image
  src="https://picsum.photos/seed/cinder/600/338"
  alt="A randomly selected placeholder photograph"
  ratio="16/9"
  width={600}
  height={338}
/>
