<script lang="ts" module>
  export const title = 'Inside FormField';
  export const description = 'Uses FormField for the label, hint text, and required-state wiring.';
</script>

<script lang="ts">
  import { Autocomplete, FormField } from '@lostgradient/cinder';

  const languages = [
    { value: 'TypeScript', description: 'Typed JavaScript' },
    { value: 'Svelte', description: 'Compiler-driven UI' },
    { value: 'Rust', description: 'Systems programming' },
    { value: 'Zig', description: 'Low-level tooling' },
  ];

  let value = $state('');
</script>

<FormField
  id="autocomplete-form-field"
  label="Primary language"
  description="Start typing and either choose a suggestion or keep your own wording."
  required
>
  <Autocomplete
    id="autocomplete-form-field"
    placeholder="Type a language"
    suggestionSource={(query: string) =>
      languages.filter((language) => language.value.toLowerCase().includes(query.toLowerCase()))}
    bind:value
  />
</FormField>
