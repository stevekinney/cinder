<script lang="ts" module>
  export const title = 'Basic multi-select';
  export const description = 'Pick multiple values and show the selected count on the trigger.';
</script>

<script lang="ts">
  import { MultiSelect } from '@lostgradient/cinder/multi-select';

  let { mountIdPrefix }: { mountIdPrefix?: string } = $props();
  const uid = $props.id();
  let fieldId = $derived(`${mountIdPrefix ?? uid}-fruit`);

  const items = [
    { id: 'apple', label: 'Apple' },
    { id: 'banana', label: 'Banana' },
    { id: 'cherry', label: 'Cherry' },
    { id: 'mango', label: 'Mango' },
    { id: 'orange', label: 'Orange' },
  ] as const;

  let selected = $state<Array<(typeof items)[number]['id']>>(['banana']);
</script>

<MultiSelect id={fieldId} label="Fruits" {items} bind:selectedIds={selected} />
