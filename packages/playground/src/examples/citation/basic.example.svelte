<script lang="ts" module>
  export const title = 'Citation';
  export const description = 'Attach a compact source marker to a claim and expose its sources.';
</script>

<script lang="ts">
  import { Citation } from '@lostgradient/cinder/citation';
</script>

<Citation sources={[{ label: 'Component metadata guide', url: '/docs/components' }]} />
