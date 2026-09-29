<script lang="ts">
  import Modal from './modal.svelte';
  let { open, title }: { open: boolean; title: string } = $props();
</script>

<Modal {open} {title}>
  <p id="modal-body-copy">Are you sure?</p>
</Modal>
