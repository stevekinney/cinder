<script lang="ts">
  import SchemaForm from './schema-form.svelte';

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
</script>

<SchemaForm {schema} onsubmit={handleSubmit} />
