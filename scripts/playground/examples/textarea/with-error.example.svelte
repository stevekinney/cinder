<script lang="ts" module>
  export const title = 'Textarea with error';
  export const description = 'Validation error wired via aria-invalid and aria-describedby.';
</script>

<script lang="ts">
  import { Textarea } from '../../../../src/index.ts';

  let message = $state('');
  const hasError = $derived(message.length > 0 && message.length < 20);
</script>

<Textarea
  id="message"
  bind:value={message}
  label="Message"
  rows={5}
  placeholder="Write at least 20 characters…"
  {...hasError ? { error: 'Minimum 20 characters.' } : {}}
/>
