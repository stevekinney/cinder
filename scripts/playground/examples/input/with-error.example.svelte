<script lang="ts" module>
  export const title = 'Input with error';
  export const description = 'Error message wired via aria-invalid and aria-describedby.';
</script>

<script lang="ts">
  import { Input } from '../../../../src/index.ts';

  let email = $state('not-an-email');
  const hasError = $derived(!email.includes('@'));
</script>

<Input
  id="email"
  type="email"
  bind:value={email}
  label="Email address"
  description="We'll never share your email."
  {...hasError ? { error: 'Enter a valid email address.' } : {}}
/>
