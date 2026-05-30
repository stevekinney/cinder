import type { ComponentSchema } from '../../schema-types';

const schema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  properties: {
    entries: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            description: 'Stable id used as the keyed list identity.',
          },
          datetime: {
            type: 'string',
            description: 'Machine-readable ISO datetime rendered into `<time datetime>`.',
          },
          timestamp: {
            type: 'string',
            description: 'Visible timestamp label rendered inside `<time>`.',
          },
          title: {
            type: 'string',
            description: 'Visible event title.',
          },
          tone: {
            enum: ['info', 'success', 'warning', 'error'],
            description: 'Semantic marker tone.',
            default: 'info',
          },
          groupLabel: {
            type: 'string',
            description: 'Optional day/week group label override. The first entry in a group wins.',
          },
        },
        additionalProperties: false,
        required: ['datetime', 'id', 'timestamp', 'title'],
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
      description: 'Optional adjacent UTC day/week grouping mode.',
      default: 'none',
    },
    weekStartsOn: {
      enum: ['sunday', 'monday'],
      description: 'Week start used for UTC week grouping.',
      default: 'monday',
    },
    groupHeaderLevel: {
      enum: [1, 2, 3, 4, 5, 6],
      description: 'Heading level applied to rendered group headers.',
      default: 3,
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
