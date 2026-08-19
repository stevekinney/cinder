<script lang="ts">
  import Card from '@lostgradient/cinder/card';
  import ConfirmDialog from '@lostgradient/cinder/confirm-dialog';

  let confirmDialogOpen = $state(false);
  let hydrated = $state(false);

  $effect(() => {
    hydrated = true;
  });
</script>

<main data-dev-ssr-hydrated={hydrated}>
  <button
    type="button"
    data-dev-ssr-confirm-dialog-trigger
    onclick={() => (confirmDialogOpen = true)}
  >
    Reset state
  </button>
  <ConfirmDialog
    bind:open={confirmDialogOpen}
    title="Reset all local state?"
    description="This cannot be undone."
    confirmLabel="Reset local state"
    onConfirm={() => {}}
  />

  <Card title="Place a food order" headingLevel={2}>
    <p data-dev-ssr-card-body>Spicy noodles</p>
  </Card>
</main>
