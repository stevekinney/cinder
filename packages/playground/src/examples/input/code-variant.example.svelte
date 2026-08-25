<script lang="ts" module>
  export const title = 'Code variant';
  export const description =
    'variant="code" applies a shared monospace metric set for source-like values such as regular expressions, URIs, or identifiers.';
</script>

<script lang="ts">
  import { Input } from '@lostgradient/cinder/input';

  let { mountIdPrefix }: { mountIdPrefix?: string } = $props();
  const uid = $props.id();
  let fieldId = $derived(`${mountIdPrefix ?? uid}-field`);

  let pattern = $state('^[a-z0-9-]+$');
</script>

<Input id={fieldId} bind:value={pattern} label="Pattern (regex)" variant="code" />
