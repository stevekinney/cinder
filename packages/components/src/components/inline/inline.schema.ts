import type { ComponentSchema } from '../../schema-types';

const schema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  properties: {
    gap: {
      type: 'string',
      description:
        'Gap between children. Threads to `--inline-gap`. When omitted, the CSS\nfallback is `var(--cinder-space-4)`.',
    },
    wrap: {
      enum: ['wrap', 'nowrap', 'wrap-reverse'],
      description:
        'Flex-wrap value. Threads to `--inline-wrap`. When omitted, the CSS\nfallback is `wrap`.',
      default: 'wrap',
    },
    align: {
      type: 'string',
      description:
        '`align-items` value. Threads to `--inline-align`. When omitted, the CSS\nfallback is `center`.',
    },
    as: {
      type: 'string',
      description: 'Rendered HTML tag.',
      default: 'div',
    },
    class: {
      type: 'string',
      description: 'Custom class merged with `.cinder-inline`.',
    },
  },
  additionalProperties: false,
} satisfies ComponentSchema;

export default schema as ComponentSchema;
