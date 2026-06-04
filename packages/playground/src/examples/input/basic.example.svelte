<script lang="ts" module>
  export const title = 'Basic input';
  export const description = 'Text input with label and bound value.';
</script>

<script lang="ts">
  import { Input } from '@lostgradient/cinder/input';
  let name = $state('');
</script>

<Input id="name" bind:value={name} label="Full name" placeholder="Jane Smith" />
{#if name}
  <p style="margin-top: 0.5rem; color: var(--cinder-text-muted);">Hello, {name}!</p>
{/if}
