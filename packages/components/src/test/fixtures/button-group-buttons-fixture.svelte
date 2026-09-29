<script lang="ts">
  import Button from '../../components/button/button.svelte';
  import ButtonGroup from '../../components/button-group/button-group.svelte';

  let { label = 'Actions' }: { label?: string } = $props();
</script>

<ButtonGroup {label}>
  <Button>Save</Button>
  <Button>Cancel</Button>
</ButtonGroup>
