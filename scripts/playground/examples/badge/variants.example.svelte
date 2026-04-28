<script lang="ts" module>
  export const title = 'Badge variants';
  export const description = 'All five semantic variant styles.';
</script>

<script lang="ts">
  import { Badge } from '../../../../src/index.ts';
</script>

<div style="display: flex; flex-wrap: wrap; gap: 0.5rem; align-items: center;">
  <Badge variant="neutral">Neutral</Badge>
  <Badge variant="success">Success</Badge>
  <Badge variant="warning">Warning</Badge>
  <Badge variant="danger">Danger</Badge>
  <Badge variant="info">Info</Badge>
</div>
