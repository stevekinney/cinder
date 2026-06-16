<script lang="ts" module>
  export const title = 'Auto-fill cards';
  export const description =
    'Grid can create intrinsic responsive columns from a minimum item width.';
</script>

<script lang="ts">
  import { Card } from '@lostgradient/cinder/card';
  import { Grid } from '@lostgradient/cinder/grid';
</script>

<Grid minItemWidth="14rem" gap="var(--cinder-space-4)">
  <Card>Analytics</Card>
  <Card>Integrations</Card>
  <Card>Billing</Card>
  <Card>Audit log</Card>
</Grid>
