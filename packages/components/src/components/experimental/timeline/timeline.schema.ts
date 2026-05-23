import type { ComponentSchema } from '../../../schema-types';

const schema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  properties: {
    entries: {
      type: 'array',
      items: {
        type: 'object',
      },
      description: 'Timeline entries rendered in source order.',
    },
    orientation: {
      enum: ['vertical', 'horizontal'],
      description: 'Layout orientation.',
      default: 'vertical',
    },
    groupBy: {
      enum: ['none', 'day', 'week'],
      description: 'Optional adjacent grouping mode.',
      default: 'none',
    },
    weekStartsOn: {
      enum: ['sunday', 'monday'],
      description: 'Week start used for week grouping.',
      default: 'monday',
    },
    gapThresholdMinutes: {
      type: 'number',
      description: 'Hide the following connector when adjacent valid timestamps exceed this gap.',
    },
    label: {
      type: 'string',
      description:
        'Fallback accessible label used only when aria-label and aria-labelledby are absent.',
    },
    class: {
      type: 'string',
      description: 'Additional class names merged with `.cinder-timeline`.',
    },
  },
  additionalProperties: false,
  required: ['entries'],
} satisfies ComponentSchema;

export default schema as ComponentSchema;
