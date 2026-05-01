<script lang="ts" module>
  export const title = 'Required label';
  export const description =
    'The required indicator is decorative; the field carries the real semantic.';
</script>

<script lang="ts">
  import { Input, Label } from '../../../../components/src/index.ts';

  let value = $state('');
</script>

<div style="display: flex; flex-direction: column; gap: 0.4rem; max-width: 24rem;">
  <Label for="required-email-input" required>Email address</Label>
  <Input id="required-email-input" type="email" required placeholder="you@example.com" bind:value />
</div>
