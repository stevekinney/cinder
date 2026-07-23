<script lang="ts" module>
  export const title = 'JSON Schema';
  export const description = 'Render and submit a payload from a JSON Schema object.';
</script>

<script lang="ts">
  import { SchemaForm } from '@lostgradient/cinder/schema-form';

  const schema = {
    type: 'object',
    title: 'Schedule',
    properties: {
      name: { type: 'string', title: 'Name', minLength: 1 },
      retries: { type: 'integer', title: 'Retries', minimum: 0 },
      enabled: { type: 'boolean', title: 'Enabled' },
      cadence: { type: 'string', title: 'Cadence', enum: ['hourly', 'daily', 'weekly'] },
    },
    required: ['name', 'retries', 'enabled', 'cadence'],
  };

  let draft = $state('No edits yet.');
  let submitted = $state('No payload submitted yet.');

  function handleDraftChange(value: unknown) {
    draft = JSON.stringify(value, null, 2);
  }

  function handleSubmit(value: unknown) {
    submitted = JSON.stringify(value, null, 2);
  }
</script>

<div style="display: grid; gap: 1rem;">
  <SchemaForm
    {schema}
    name="payload"
    value={{ name: 'Refresh indexes', retries: 2, enabled: true, cadence: 'daily' }}
    submitLabel="Save schedule"
    ondraftchange={handleDraftChange}
    onsubmit={handleSubmit}
  />

  <section>
    <h3>Live draft</h3>
    <pre>{draft}</pre>
  </section>

  <section>
    <h3>Last valid submission</h3>
    <pre>{submitted}</pre>
  </section>
</div>
