<script lang="ts">
  import { z } from 'zod';

  import SchemaForm from './schema-form.svelte';

  const schema = z.object({
    name: z.string(),
    count: z.number(),
  });

  function handleSubmit(value: z.infer<typeof schema>) {
    const name: string = value.name;
    const count: number = value.count;
    void name;
    void count;
  }
</script>

<SchemaForm {schema} onsubmit={handleSubmit} />
