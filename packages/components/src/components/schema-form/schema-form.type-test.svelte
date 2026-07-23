<script lang="ts">
  import SchemaForm from './schema-form.svelte';
  import type { SchemaFormDraftChangeHandler } from './schema-form.types.ts';

  const schema = {
    type: 'object',
    properties: {
      name: { type: 'string' },
      count: { type: 'number' },
    },
    required: ['name', 'count'],
  };

  function handleSubmit(value: unknown) {
    void value;
  }

  const handleDraftChange: SchemaFormDraftChangeHandler = (value) => {
    void value;
  };
</script>

<SchemaForm {schema} ondraftchange={handleDraftChange} onsubmit={handleSubmit} />
