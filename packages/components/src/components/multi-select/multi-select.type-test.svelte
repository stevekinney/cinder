<script lang="ts">
  import MultiSelect from './multi-select.svelte';

  const fruitItems = [
    { id: 'apple', label: 'Apple' },
    { id: 'banana', label: 'Banana' },
    { id: 'cherry', label: 'Cherry' },
  ] as const;

  let selected = $state<Array<'apple' | 'banana' | 'cherry'>>(['apple']);

  const plainItems = [
    { id: 'a', label: 'A' },
    { id: 'b', label: 'B' },
  ];
  let plainSelected = $state(['a']);
</script>

<MultiSelect id="bound" items={fruitItems} bind:selectedIds={selected} />
<MultiSelect id="valid" items={fruitItems} selectedIds={['apple', 'banana']} />
<MultiSelect id="plain" items={plainItems} bind:selectedIds={plainSelected} />
