<script lang="ts">
  import type { Attachment } from 'svelte/attachments';

  import Input from '../../components/input/input.svelte';

  let { inputAttachment }: { inputAttachment?: Attachment<HTMLInputElement> } = $props();
  let value = $state('');
</script>

<form data-testid="form">
  <Input id="name" bind:value {...inputAttachment ? { inputAttachment } : {}} />
  <button type="reset">Reset</button>
</form>

<output data-testid="value">{value}</output>
