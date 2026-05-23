<script lang="ts" module>
  export const title = 'Center basic';
  export const description = 'Block centered horizontally with the default content-width cap.';
</script>

<script lang="ts">
  import { Center } from 'cinder/center';
</script>

<Center maxWidth="32rem">
  <p>
    This block is horizontally centered and capped at a configurable max-inline-size. Resize the
    viewport to see the cap stay in effect.
  </p>
</Center>
