import type { ComponentSchema } from '../../schema-types';

const schema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  properties: {
    mode: {
      enum: ['display', 'toggle', 'removable'],
    },
    label: {
      type: 'string',
    },
    variant: {
      enum: ['neutral', 'success', 'warning', 'danger', 'info', 'accent'],
    },
    size: {
      enum: ['sm', 'md'],
    },
    density: {
      const: 'toolbar',
    },
    class: {
      type: 'string',
    },
    id: {
      type: 'string',
    },
    title: {
      type: 'string',
    },
  },
  additionalProperties: false,
  required: ['label'],
  metadata: {
    unsupportedProps: [
      {
        name: 'leadingIcon',
        reason: 'function-or-snippet',
      },
    ],
  },
} satisfies ComponentSchema;

export default schema as ComponentSchema;
