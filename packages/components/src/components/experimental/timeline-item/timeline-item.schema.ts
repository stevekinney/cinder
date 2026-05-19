import type { ComponentSchema } from '../../../schema-types';

const schema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  properties: {
    time: {
      type: 'string',
      description: 'Optional ISO timestamp / formatted time string for the entry header.',
    },
    title: {
      type: 'string',
      description: 'Visible event title.',
    },
    status: {
      enum: ['info', 'success', 'warning', 'danger'],
      description: 'Optional status that drives the marker color via a data attribute.',
      default: 'info',
    },
    class: {
      type: 'string',
      description: 'Additional class names merged with `.cinder-timeline-item`.',
    },
  },
  additionalProperties: false,
} satisfies ComponentSchema;

export default schema as ComponentSchema;
