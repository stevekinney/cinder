import type { ComponentSchema } from '../../../schema-types';

const schema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  properties: {
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
    connectorAfter: {
      enum: ['visible', 'hidden'],
      description: 'Whether to draw the connector to the following event.',
      default: 'visible',
    },
    groupHeader: {
      type: 'string',
      description:
        'Optional adjacent group header rendered inside this list item before the event body.',
    },
    class: {
      type: 'string',
      description: 'Additional class names merged with `.cinder-timeline-item`.',
    },
  },
  additionalProperties: false,
  required: ['datetime', 'timestamp', 'title'],
} satisfies ComponentSchema;

export default schema as ComponentSchema;
