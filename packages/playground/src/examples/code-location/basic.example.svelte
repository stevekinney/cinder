<script lang="ts" module>
  export const title = 'CodeLocation';
  export const description = 'Render a compact file, line, and column reference.';
</script>

<script lang="ts">
  import { CodeLocation } from '@lostgradient/cinder/code-location';
</script>

<CodeLocation file="src/routes/+page.svelte" />
