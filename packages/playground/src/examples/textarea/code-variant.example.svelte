<script lang="ts" module>
  export const title = 'Code variant';
  export const description =
    'variant="code" applies a shared monospace metric set for source-like values such as raw JSON, YAML, or configuration text.';
</script>

<script lang="ts">
  import { Textarea } from '@lostgradient/cinder/textarea';

  let { mountIdPrefix }: { mountIdPrefix?: string } = $props();
  const uid = $props.id();
  let fieldId = $derived(`${mountIdPrefix ?? uid}-field`);

  let json = $state('{\n  "name": "Ada",\n  "active": true\n}');
</script>

<Textarea id={fieldId} bind:value={json} label="Raw JSON" variant="code" rows={6} />
