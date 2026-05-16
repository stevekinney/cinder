<script lang="ts" module>
  export const title = 'Sign-in composition';
  export const description =
    'Composition of FormField + Input + Button with a top-of-form Alert auth-error region. Demonstrates the required autocomplete values and the assertive announcement pattern via role="alert".';
</script>

<script lang="ts">
  import { Alert, Button, FormField, Input } from '../../../../components/src/index.ts';

  let email = $state('');
  let password = $state('');
  let authError = $state<string | undefined>(undefined);
  let submitting = $state(false);

  function handleSignIn() {
    // Clear any prior error so a re-submit re-announces by re-mounting the Alert
    // rather than mutating its text (assistive tech announces on mount of role="alert").
    authError = undefined;
    submitting = true;

    // Static example: simulate an auth failure. Do not call a real auth service.
    setTimeout(() => {
      authError = 'Email or password is incorrect.';
      submitting = false;
    }, 600);
  }
</script>

<form
  novalidate
  aria-labelledby="sign-in-heading"
  onsubmit={(event) => {
    event.preventDefault();
    handleSignIn();
  }}
>
  <h2 id="sign-in-heading" style="margin: 0 0 1rem;">Sign in</h2>

  <!--
    Top-of-form auth-error region.
    Alert's role="alert" implies aria-live="assertive" and aria-atomic="true".
    We intentionally do NOT add an explicit aria-live attribute (see alert.test.ts:
    "has role=alert on root element and does not set an explicit aria-live").
    Mounting the Alert in response to submit triggers the assertive announcement.
  -->
  {#if authError}
    <Alert variant="error">
      {authError}
    </Alert>
  {/if}

  <FormField id="sign-in-email" label="Email" required>
    <!-- autocomplete="email" — the identifier is an email address.
         Use "username" instead when the field collects an opaque handle. -->
    <Input
      id="sign-in-email"
      type="email"
      bind:value={email}
      autocomplete="email"
      required
      placeholder="you@example.com"
    />
  </FormField>

  <FormField id="sign-in-password" label="Password" required>
    <!-- autocomplete="current-password" — required for password managers to
         recognize this as a sign-in form and offer saved credentials. -->
    <Input
      id="sign-in-password"
      type="password"
      bind:value={password}
      autocomplete="current-password"
      required
    />
  </FormField>

  <Button type="submit" variant="primary" loading={submitting}>
    {submitting ? 'Signing in…' : 'Sign in'}
  </Button>
</form>
