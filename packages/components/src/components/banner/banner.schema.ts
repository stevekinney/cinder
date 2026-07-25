import type { ComponentSchema } from '../../schema-types';

const schema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  properties: {
    variant: {
      enum: ['info', 'success', 'warning', 'danger'],
      description: "Visual + semantic variant. Default `'info'`.",
    },
    dismissible: {
      type: 'boolean',
      description: 'Whether the banner shows a dismiss (×) button. Default `true`.',
    },
    class: {
      type: 'string',
      description:
        'Extra classes appended to the root element. Pass via the explicit\n`class` prop — it is excluded from rest-prop spread, so writing\n`class="x"` inside spread attributes will not reach the root.',
    },
  },
  additionalProperties: false,
  metadata: {
    unsupportedProps: [
      {
        name: 'actions',
        reason: 'function-or-snippet',
        description: 'Optional trailing CTA region (e.g., "Renew now" button).',
      },
      {
        name: 'children',
        reason: 'function-or-snippet',
        required: true,
        description: 'Banner body content.',
      },
      {
        name: 'onDismiss',
        reason: 'function-or-snippet',
        description: 'Called after the dismiss button is clicked. Use to persist state.',
      },
    ],
  },
} satisfies ComponentSchema;

export default schema as ComponentSchema;
