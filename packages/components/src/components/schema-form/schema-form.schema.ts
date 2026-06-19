import type { ComponentSchema } from '../../schema-types';

const schema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  properties: {
    name: {
      type: 'string',
      description: 'Name of the hidden serialized output field. Defaults to `value`.',
    },
    submitLabel: {
      type: 'string',
      description: 'Label for the built-in submit button. Defaults to `Submit`.',
    },
    class: {
      type: 'string',
      description: 'Custom class merged with `.cinder-schema-form`.',
    },
  },
  additionalProperties: false,
  metadata: {
    unsupportedProps: [
      {
        name: 'onsubmit',
        reason: 'function-or-snippet',
        description: 'Called after validation passes with the schema-conformant output value.',
      },
      {
        name: 'schema',
        reason: 'generic-type-parameter',
        required: true,
        description:
          'JSON Schema object or Standard Schema object used to render and validate the form.',
      },
      {
        name: 'value',
        reason: 'unknown-shape',
        description:
          'Initial form value. Missing fields are seeded from the schema where possible.',
      },
    ],
  },
} satisfies ComponentSchema;

export default schema as ComponentSchema;
