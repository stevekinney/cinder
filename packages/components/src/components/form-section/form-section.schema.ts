import type { ComponentSchema } from '../../schema-types';

const schema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  properties: {
    description: {
      type: 'string',
      description: 'Optional descriptive paragraph rendered under the heading/legend.',
    },
    columns: {
      enum: [2, 3, 4, 1],
      description: 'Column ceiling. Container queries pick the actual rendered count. Default 2.',
    },
    class: {
      type: 'string',
      description: 'Additional class merged with `.cinder-form-section`.',
    },
    as: {
      enum: ['section', 'fieldset'],
      description: 'Wrapper element. Default.',
    },
    heading: {
      type: 'string',
      description: 'Heading text rendered as `<h{level}>`.',
    },
    headingLevel: {
      enum: [2, 3, 4, 5, 6],
      description: 'Heading level. Default 2.',
    },
  },
  additionalProperties: false,
  metadata: {
    unsupportedProps: [
      {
        name: 'children',
        reason: 'function-or-snippet',
      },
    ],
  },
} satisfies ComponentSchema;

export default schema as ComponentSchema;
