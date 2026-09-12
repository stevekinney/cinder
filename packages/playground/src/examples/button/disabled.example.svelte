<script lang="ts" module>
  export const title = 'Disabled button';
  export const description =
    'A plain (non-icon-only) disabled button. The secondary variant has no variant-specific disabled override, so its border color comes from the base disabled rule in button.css while its opacity comes from the shared disabled-visual rule in foundation.css.';
</script>

<script lang="ts">
  import { Button } from '@lostgradient/cinder/button';
</script>

<div class="example-preview-row">
  <Button disabled={true} label="Disabled" data-testid="button-secondary-disabled" />
</div>
