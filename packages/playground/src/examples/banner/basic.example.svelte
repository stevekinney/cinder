<script lang="ts" module>
  export const title = 'Basic banner';
  export const description = 'Informational page-level banner with a dismiss button.';
</script>

<script lang="ts">
  import { Banner } from '@lostgradient/cinder/banner';

  let visible = $state(true);
</script>

{#if visible}
  <Banner variant="info" ondismiss={() => (visible = false)}>
    Scheduled maintenance is planned for Sunday at 2:00 AM UTC.
  </Banner>
{:else}
  <p style="color: var(--cinder-text-muted);">Banner dismissed.</p>
{/if}
