import type { ComponentSchema } from '../../schema-types';

const schema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  properties: {
    maxWidth: {
      type: 'string',
      description:
        'Maximum inline size. Threads to `--center-max-width`. When omitted, the\nCSS fallback is `var(--cinder-content-width)`.',
    },
    minHeight: {
      type: 'string',
      description:
        'Minimum block size. Threads to `--center-min-height`. When omitted, no\nminimum is applied.',
    },
    intrinsic: {
      type: 'boolean',
      description:
        "When true, the element centers based on the intrinsic width of its\ncontent rather than expanding to fill the available width. Overflowing\ncontent remains the consumer's responsibility — set overflow rules on\nchildren directly.",
      default: false,
    },
    as: {
      type: 'string',
      description: 'Rendered HTML tag.',
      default: 'div',
    },
    class: {
      type: 'string',
      description: 'Custom class merged with `.cinder-center`.',
    },
  },
  additionalProperties: false,
} satisfies ComponentSchema;

export default schema as ComponentSchema;
