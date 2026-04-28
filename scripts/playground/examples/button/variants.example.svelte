<script lang="ts" module>
  export const title = 'Button variants';
  export const description = 'Primary, secondary, danger, and ghost styles.';
</script>

<script lang="ts">
  import { Button } from '../../../../src/index.ts';
</script>

<div style="display: flex; flex-wrap: wrap; gap: 0.5rem; align-items: center;">
  <Button variant="primary" label="Primary" />
  <Button variant="secondary" label="Secondary" />
  <Button variant="danger" label="Danger" />
  <Button variant="ghost" label="Ghost" />
</div>
