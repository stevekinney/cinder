<script lang="ts" module>
  export const title = 'Form field with error';
  export const description =
    'Error state wires aria-invalid and aria-describedby on the wrapped control.';
</script>

<script lang="ts">
  import { FormField, Input } from '../../../../components/src/index.ts';

  let email = $state('not-an-email');
</script>

<FormField
  id="email"
  label="Email address"
  description="We'll never share your email."
  error="Enter a valid email address."
  required
>
  <Input id="email" bind:value={email} type="email" placeholder="you@example.com" />
</FormField>
