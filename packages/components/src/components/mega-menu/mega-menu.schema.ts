import type { ComponentSchema } from '../../schema-types';

const schema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  properties: {
    openOnHover: {
      type: 'boolean',
      description: 'Hover opens top-level content instead of click-only mode.',
    },
    showViewport: {
      type: 'boolean',
      description: 'Render the shared content viewport wrapper.',
    },
    showIndicator: {
      type: 'boolean',
      description: 'Render an active trigger indicator bar.',
    },
    label: {
      type: 'string',
      description: 'Accessible name for the navigation landmark.',
    },
    class: {
      type: 'string',
      description: 'Additional classes merged onto the root element.',
    },
  },
  additionalProperties: false,
  metadata: {
    unsupportedProps: [
      {
        name: 'items',
        reason: 'unknown-shape',
        required: true,
        description: 'Top-level trigger/content entries.',
      },
    ],
  },
} satisfies ComponentSchema;

export default schema as ComponentSchema;
