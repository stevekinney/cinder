<script lang="ts" module>
  export const title = 'Basic number input';
  export const description = 'Numeric field with label, bounds, and a committed-value display.';
</script>

<script lang="ts">
  import { NumberInput } from '@lostgradient/cinder/number-input';

  let { mountIdPrefix }: { mountIdPrefix?: string } = $props();
  const uid = $props.id();
  let fieldId = $derived(`${mountIdPrefix ?? uid}-quantity`);

  let quantity = $state<number | null>(1);

  function handleChange(value: number | null) {
    quantity = value;
  }
</script>

<NumberInput
  id={fieldId}
  label="Quantity"
  value={quantity}
  min={1}
  max={99}
  onchange={handleChange}
/>
<p style="margin-top: 0.5rem; color: var(--cinder-text-muted);">
  Value: {quantity ?? 'empty'}
</p>
