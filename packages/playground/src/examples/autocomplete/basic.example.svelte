<script lang="ts" module>
  export const title = 'Basic autocomplete';
  export const description =
    'Free-form text stays editable while the suggestion list offers completions.';
  export const featured = true;
</script>

<script lang="ts">
  import Autocomplete from '@lostgradient/cinder/autocomplete';

  let { mountIdPrefix }: { mountIdPrefix?: string } = $props();
  const uid = $props.id();
  let fieldId = $derived(`${mountIdPrefix ?? uid}-field`);

  const fruits = [
    { value: 'apple', label: 'Apple', description: 'Classic pie filling' },
    { value: 'apricot', label: 'Apricot', description: 'Stone fruit' },
    { value: 'banana', label: 'Banana', description: 'Tropical staple' },
    { value: 'blackberry', label: 'Blackberry', description: 'Late-summer berry' },
    { value: 'blueberry', label: 'Blueberry', description: 'Breakfast favorite' },
    { value: 'grapefruit', label: 'Grapefruit', description: 'Tart citrus' },
  ];

  let value = $state('');
</script>

<Autocomplete
  id={fieldId}
  label="Favorite fruit"
  placeholder="Type a fruit"
  suggestionSource={(query: string) =>
    fruits.filter((fruit) => fruit.label?.toLowerCase().includes(query.toLowerCase()))}
  bind:value
/>
