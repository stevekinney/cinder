import type { ComponentSchema } from '../../schema-types';

const schema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  properties: {
    items: {
      type: 'array',
      items: {
        type: 'object',
      },
    },
    variant: {
      enum: ['default', 'striped', 'two-column', 'narrow'],
      description:
        'Controls the visual layout:\n- `default`: stacked rows with visible terms.\n- `striped`: alternating row backgrounds.\n- `two-column`: term and definition share a row; collapses to stacked at narrow widths.\n- `narrow`: `<dt>` is visually hidden via `.cinder-sr-only`. Only appropriate when\n  surrounding context already labels the value. NOT a general compact mode.',
    },
    class: {
      type: 'string',
    },
  },
  additionalProperties: false,
  required: ['items'],
  metadata: {
    unsupportedProps: [
      {
        name: 'actions',
        reason: 'function-or-snippet',
      },
    ],
  },
} satisfies ComponentSchema;

export default schema as ComponentSchema;
