<script lang="ts" module>
  export const title = 'Disabled label';
  export const description = 'Disabled tone matches the disabled control it labels.';
</script>

<script lang="ts">
  import { Label } from '../../../../components/src/index.ts';
</script>

<div style="display: flex; flex-direction: column; gap: 0.4rem; max-width: 24rem;">
  <Label for="disabled-input" disabled>Account region</Label>
  <input
    id="disabled-input"
    type="text"
    value="us-east-1"
    disabled
    style="padding: 0.4rem 0.6rem; border: 1px solid #c8c8c8; border-radius: 4px; background: #f4f4f4; color: #999;"
  />
</div>
