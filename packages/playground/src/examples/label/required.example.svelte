<script lang="ts" module>
  export const title = 'Required label';
  export const description =
    'The required indicator is decorative; the field carries the real semantic.';
</script>

<script lang="ts">
  import { Label } from '../../../../components/src/index.ts';
</script>

<div style="display: flex; flex-direction: column; gap: 0.4rem; max-width: 24rem;">
  <Label for="required-email-input" required>Email address</Label>
  <input
    id="required-email-input"
    type="email"
    required
    placeholder="you@example.com"
    style="padding: 0.4rem 0.6rem; border: 1px solid #c8c8c8; border-radius: 4px;"
  />
</div>
