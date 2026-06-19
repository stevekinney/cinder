<script lang="ts" module>
  export const title = 'Standard Schema';
  export const description =
    'Render from a Standard Schema object and submit its validated output.';
</script>

<script lang="ts">
  import { SchemaForm } from '@lostgradient/cinder/schema-form';

  type Payload = {
    title: string;
    attempts: number;
    urgent: boolean;
  };

  const jsonSchema = {
    type: 'object',
    title: 'Dispatch job',
    properties: {
      title: { type: 'string', title: 'Title', minLength: 1 },
      attempts: { type: 'integer', title: 'Attempts', minimum: 1 },
      urgent: { type: 'boolean', title: 'Urgent' },
    },
    required: ['title', 'attempts', 'urgent'],
  };

  function isPayload(value: Partial<Payload>): value is Payload {
    return (
      typeof value.title === 'string' &&
      value.title.length > 0 &&
      typeof value.attempts === 'number' &&
      Number.isInteger(value.attempts) &&
      value.attempts >= 1 &&
      typeof value.urgent === 'boolean'
    );
  }

  const standardSchema = {
    '~standard': {
      version: 1,
      vendor: 'example',
      jsonSchema: {
        input: () => jsonSchema,
        output: () => jsonSchema,
      },
      validate(value: unknown) {
        const candidate = value as Partial<Payload>;
        const issues = [];
        if (typeof candidate.title !== 'string' || candidate.title.length === 0) {
          issues.push({ path: ['title'], message: 'Title is required.' });
        }
        if (
          typeof candidate.attempts !== 'number' ||
          !Number.isInteger(candidate.attempts) ||
          candidate.attempts < 1
        ) {
          issues.push({ path: ['attempts'], message: 'Attempts must be a positive integer.' });
        }
        if (typeof candidate.urgent !== 'boolean') {
          issues.push({ path: ['urgent'], message: 'Urgent must be true or false.' });
        }
        return isPayload(candidate) ? { value: candidate } : { issues };
      },
    },
  } as const;

  let submitted = $state('No payload submitted yet.');

  function handleSubmit(value: unknown) {
    submitted = JSON.stringify(value, null, 2);
  }
</script>

<div style="display: grid; gap: 1rem;">
  <SchemaForm
    schema={standardSchema}
    value={{ title: 'Rebuild search index', attempts: 2, urgent: false }}
    submitLabel="Dispatch"
    onsubmit={handleSubmit}
  />

  <pre>{submitted}</pre>
</div>
