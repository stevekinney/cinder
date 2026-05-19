<script lang="ts" module>
  export const title = 'Button sizes';
  export const description = 'xs, sm, md, lg, and xl sizes.';
</script>

<script lang="ts">
  import { Button } from '../../../../components/src/index.ts';
</script>

<div class="example-preview-row">
  <Button size="xs" label="Extra Small" />
  <Button size="sm" label="Small" />
  <Button size="md" label="Medium" />
  <Button size="lg" label="Large" />
  <Button size="xl" label="Extra Large" />
</div>
