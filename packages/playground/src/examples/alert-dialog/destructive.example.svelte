<script lang="ts" module>
  export const title = 'Destructive alert dialog';
  export const description = 'A high-risk alert dialog with an optional cancel action.';
</script>

<script lang="ts">
  import { AlertDialog, Button } from 'cinder';

  let open = $state(false);
</script>

<Button variant="danger" onclick={() => (open = true)}>Delete workspace</Button>

<AlertDialog
  bind:open
  title="Delete workspace"
  description="This action removes shared project data for every collaborator."
  acknowledgeLabel="Delete workspace"
  cancelLabel="Cancel"
  destructive
  onacknowledge={() => {}}
  oncancel={() => {}}
/>
