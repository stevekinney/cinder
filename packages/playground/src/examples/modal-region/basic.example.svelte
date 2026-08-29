<script lang="ts" module>
  export const title = 'Basic modal region';
  export const description = 'Mount application content inside the modal coordination region.';
</script>

<script lang="ts">
  import { ModalRegion } from '@lostgradient/cinder/modal-region';
</script>

<ModalRegion>
  {#snippet children()}
    <p>Application content with modal support.</p>
  {/snippet}
</ModalRegion>
