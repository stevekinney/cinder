import type { ComponentSchema } from '../../schema-types';

const schema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  properties: {
    status: {
      enum: ['online', 'offline', 'warning', 'error', 'pending', 'neutral', 'success', 'accent'],
      description:
        'Required semantic status. Drives color via `data-cinder-status`. `success` maps to `--cinder-success`; `accent` maps to `--cinder-accent`.',
    },
    label: {
      type: 'string',
      description:
        'Optional human label. Rendered visibly when `showLabel` is true; used as the accessible name either way.',
    },
    showLabel: {
      type: 'boolean',
      description: 'Whether to render the visible label.',
      default: true,
    },
    size: {
      enum: ['sm', 'md'],
      description: 'Dot size.',
      default: 'md',
    },
    class: {
      type: 'string',
      description: 'Extra classes appended to the root element.',
    },
  },
  additionalProperties: false,
  required: ['status'],
} satisfies ComponentSchema;

export default schema as ComponentSchema;
