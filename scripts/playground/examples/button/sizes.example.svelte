<script lang="ts" module>
  export const title = 'Button sizes';
  export const description = 'xs, sm, md, and lg sizes.';
</script>

<script lang="ts">
  import { Button } from '../../../../src/index.ts';
</script>

<div style="display: flex; flex-wrap: wrap; gap: 0.5rem; align-items: center;">
  <Button size="xs" label="Extra Small" />
  <Button size="sm" label="Small" />
  <Button size="md" label="Medium" />
  <Button size="lg" label="Large" />
</div>
