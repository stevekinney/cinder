<script lang="ts" module>
  export const title = 'Soft variants';
  export const description =
    'Soft and soft-danger use a tinted fill with no border — mid-emphasis between ghost and primary/danger.';
</script>

<script lang="ts">
  import { Button } from '../../../../components/src/index.ts';
</script>

<div class="example-preview-row">
  <Button variant="soft" label="Soft" />
  <Button variant="soft-danger" label="Soft Danger" />
</div>
