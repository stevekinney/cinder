<script lang="ts" module>
  export const title = 'Basic modal';
  export const description =
    'A modal used as a generic content shell — in this case an invite form with structured fields.';
</script>

<script lang="ts">
  import { Button } from 'cinder/button';
  import { Input } from 'cinder/input';
  import { Modal } from 'cinder/modal';

  let open = $state(false);
  let triggerRef: HTMLElement | null = $state(null);
  let email = $state('');
  let name = $state('');

  function handleSend() {
    open = false;
  }
</script>

<Button
  label="Invite teammate"
  onclick={(event) => {
    triggerRef = event.currentTarget;
    open = true;
  }}
/>

<Modal bind:open title="Invite teammate" {triggerRef}>
  <div style="display: grid; gap: 1rem;">
    <Input id="invite-name" label="Full name" placeholder="Alex Kim" bind:value={name} autofocus />
    <Input
      id="invite-email"
      label="Email address"
      type="email"
      placeholder="alex@example.com"
      bind:value={email}
    />
  </div>

  {#snippet footer()}
    <div style="display: flex; gap: 0.5rem; justify-content: flex-end;">
      <Button variant="secondary" label="Cancel" onclick={() => (open = false)} />
      <Button variant="primary" label="Send invite" onclick={handleSend} />
    </div>
  {/snippet}
</Modal>
