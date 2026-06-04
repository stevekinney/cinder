<script lang="ts" module>
  export const title = 'Basic alert dialog';
  export const description = 'A sticky acknowledgement dialog that cannot be dismissed by Escape.';
</script>

<script lang="ts">
  import { AlertDialog, Button } from '@lostgradient/cinder';

  let open = $state(false);
</script>

<Button onclick={() => (open = true)}>Open alert dialog</Button>

<AlertDialog
  bind:open
  title="Session requires attention"
  description="Review this message before continuing. Escape and backdrop clicks intentionally keep the dialog open."
  acknowledgeLabel="I understand"
  onacknowledge={() => {}}
/>
