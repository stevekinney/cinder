import type { ComponentSchema } from '../../schema-types';

const schema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  properties: {
    label: {
      type: 'string',
      description: 'Visible label rendered in a `<label>` element associated via `for`.',
    },
    description: {
      type: 'string',
      description: 'Helper text displayed below the checkbox; wired via `aria-describedby`.',
    },
    error: {
      type: 'string',
      description: 'Validation error message; sets `aria-invalid="true"` and `aria-describedby`.',
    },
  },
  additionalProperties: false,
  metadata: {
    unsupportedProps: [
      {
        name: 'class',
        reason: 'unknown-shape',
      },
    ],
  },
} satisfies ComponentSchema;

export default schema as ComponentSchema;
