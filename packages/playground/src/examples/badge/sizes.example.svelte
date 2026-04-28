<script lang="ts" module>
  export const title = 'Badge sizes';
  export const description = 'Small and medium sizes.';
</script>

<script lang="ts">
  import { Badge } from '../../../../components/src/index.ts';
</script>

<div style="display: flex; flex-wrap: wrap; gap: 0.5rem; align-items: center;">
  <Badge size="sm">Small</Badge>
  <Badge size="md">Medium</Badge>
</div>
