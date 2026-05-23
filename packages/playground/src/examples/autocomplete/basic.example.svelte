<script lang="ts" module>
  export const title = 'Basic autocomplete';
  export const description =
    'Free-form text stays editable while the suggestion list offers completions.';
</script>

<script lang="ts">
  import Autocomplete from 'cinder/autocomplete';

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
  id="autocomplete-basic"
  label="Favorite fruit"
  placeholder="Type a fruit"
  suggestionSource={(query: string) =>
    fruits.filter((fruit) => fruit.label?.toLowerCase().includes(query.toLowerCase()))}
  bind:value
/>
