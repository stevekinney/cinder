import type { ComponentSchema } from '../../schema-types';

const schema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  properties: {
    colSpan: {
      anyOf: [
        {
          type: 'string',
        },
        {
          type: 'number',
        },
      ],
      description: 'Number of columns this cell spans.',
    },
    rowSpan: {
      anyOf: [
        {
          type: 'string',
        },
        {
          type: 'number',
        },
      ],
      description: 'Number of rows this cell spans.',
    },
    columnStart: {
      anyOf: [
        {
          type: 'string',
        },
        {
          type: 'number',
        },
      ],
      description: 'Explicit `grid-column-start` value.',
    },
    columnEnd: {
      anyOf: [
        {
          type: 'string',
        },
        {
          type: 'number',
        },
      ],
      description: 'Explicit `grid-column-end` value.',
    },
    rowStart: {
      anyOf: [
        {
          type: 'string',
        },
        {
          type: 'number',
        },
      ],
      description: 'Explicit `grid-row-start` value.',
    },
    rowEnd: {
      anyOf: [
        {
          type: 'string',
        },
        {
          type: 'number',
        },
      ],
      description: 'Explicit `grid-row-end` value.',
    },
    as: {
      type: 'string',
      description: 'Rendered HTML tag.',
    },
    class: {
      type: 'string',
      description: 'Custom class merged with `.cinder-bento-cell`.',
    },
  },
  additionalProperties: false,
  metadata: {
    unsupportedProps: [
      {
        name: 'children',
        reason: 'function-or-snippet',
        required: true,
        description: 'Bento cell contents.',
      },
    ],
  },
} satisfies ComponentSchema;

export default schema as ComponentSchema;
