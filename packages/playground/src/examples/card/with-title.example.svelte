<script lang="ts" module>
  export const title = 'Card with title';
  export const description = 'Simple API: title + description string props.';
</script>

<script lang="ts">
  import { Card } from '../../../../components/src/index.ts';
</script>

<Card title="Monthly summary" description="Revenue and activity for April 2026.">
  <p>Total revenue: $12,400</p>
  <p>New users: 284</p>
</Card>
