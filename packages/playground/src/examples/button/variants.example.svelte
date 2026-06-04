<script lang="ts" module>
  export const title = 'Button variants';
  export const description = 'Primary, secondary, danger, and ghost styles.';
</script>

<script lang="ts">
  import { Button } from '@lostgradient/cinder/button';
</script>

<div class="example-preview-row">
  <Button variant="primary" label="Primary" />
  <Button variant="secondary" label="Secondary" />
  <Button variant="danger" label="Danger" />
  <Button variant="ghost" label="Ghost" />
</div>
