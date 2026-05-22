import type { ComponentSchema } from '../../schema-types';

const schema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  properties: {
    gap: {
      type: 'string',
      description:
        'Gap between children. Threads to `--stack-gap`. When omitted, the CSS\nfallback is `var(--cinder-space-4)`.',
    },
    direction: {
      enum: ['column', 'column-reverse'],
      description:
        'Flex direction. Threads to `--stack-direction`. When omitted, the CSS\nfallback is `column`.',
      default: 'column',
    },
    as: {
      type: 'string',
      description: 'Rendered HTML tag.',
      default: 'div',
    },
    class: {
      type: 'string',
      description: 'Custom class merged with `.cinder-stack`.',
    },
  },
  additionalProperties: false,
} satisfies ComponentSchema;

export default schema as ComponentSchema;
