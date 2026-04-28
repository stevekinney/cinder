<script lang="ts" module>
  export const title = 'Card with header snippet';
  export const description = 'Full control over the header via the header snippet.';
</script>

<script lang="ts">
  import { Badge, Card } from '../../../../components/src/index.ts';
</script>

<Card>
  {#snippet header()}
    <div style="display: flex; justify-content: space-between; align-items: center;">
      <strong>Open issues</strong>
      <Badge variant="danger">12</Badge>
    </div>
  {/snippet}
  <p>These issues require attention before the next release.</p>
  {#snippet footer()}
    <a href="#">View all →</a>
  {/snippet}
</Card>
