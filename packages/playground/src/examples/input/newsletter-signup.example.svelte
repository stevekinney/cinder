<script lang="ts" module>
  export const title = 'Newsletter signup';
  export const description =
    'An email-capture section recipe: a form pairs Input with a submit Button inside a raised panel, with heading copy and a consent line.';
</script>

<script lang="ts">
  import { Button } from '@lostgradient/cinder/button';
  import { Container } from '@lostgradient/cinder/container';
  import { Input } from '@lostgradient/cinder/input';

  let { mountIdPrefix }: { mountIdPrefix?: string } = $props();
  const uid = $props.id();
  let emailId = $derived(`${mountIdPrefix ?? uid}-newsletter-email`);

  let email = $state('');

  function handleSubmit(event: SubmitEvent): void {
    event.preventDefault();
    // eslint-disable-next-line no-console
    console.log('newsletter signup', email.trim());
  }
</script>

<section style="padding-block: var(--cinder-space-10);">
  <Container maxWidth="wide">
    <div
      style="border: 1px solid var(--cinder-border); background: var(--cinder-surface-raised); border-radius: var(--cinder-radius-lg); padding: var(--cinder-space-6); display: grid; gap: var(--cinder-space-4);"
    >
      <header style="display: grid; gap: var(--cinder-space-2);">
        <h2 style="margin: 0;">Stay ahead with monthly product insights</h2>
        <p style="margin: 0; color: var(--cinder-text-muted);">
          Get shipping tips, release notes, and real-world examples from the Cinder team.
        </p>
      </header>

      <form
        style="display: flex; flex-wrap: wrap; gap: var(--cinder-space-3); align-items: flex-end;"
        onsubmit={handleSubmit}
      >
        <div style="flex: 1 1 16rem; min-inline-size: 0;">
          <Input id={emailId} type="email" label="Email address" bind:value={email} required />
        </div>
        <Button type="submit" label="Subscribe" variant="primary" />
      </form>

      <p style="margin: 0; color: var(--cinder-text-muted);">
        No spam. One email per month. Unsubscribe anytime.
      </p>
      <p style="margin: 0; font-size: var(--cinder-text-sm); color: var(--cinder-text-subtle);">
        We respect your inbox and your privacy.
      </p>
    </div>
  </Container>
</section>
