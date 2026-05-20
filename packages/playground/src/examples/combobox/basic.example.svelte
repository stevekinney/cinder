<script lang="ts" module>
  export const title = 'Basic combobox';
  export const description =
    'Type to filter; the list is filtered with a case-insensitive substring match.';
</script>

<script lang="ts">
  import { Combobox } from 'cinder/combobox';
  const fruits = [
    { value: 'apple', label: 'Apple' },
    { value: 'apricot', label: 'Apricot' },
    { value: 'banana', label: 'Banana' },
    { value: 'blackberry', label: 'Blackberry' },
    { value: 'cherry', label: 'Cherry' },
    { value: 'grape', label: 'Grape' },
    { value: 'mango', label: 'Mango' },
    { value: 'peach', label: 'Peach' },
    { value: 'pineapple', label: 'Pineapple' },
    { value: 'raspberry', label: 'Raspberry' },
  ];

  let selected = $state('');
</script>

<Combobox
  id="combobox-fruit"
  label="Favorite fruit"
  placeholder="Start typing…"
  options={fruits}
  bind:value={selected}
/>
