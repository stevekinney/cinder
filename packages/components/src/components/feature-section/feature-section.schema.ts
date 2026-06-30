import type { ComponentSchema } from '../../schema-types';

const schema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  properties: {
    as: {
      enum: ['section', 'div'],
      description: 'Wrapper element tag.',
      default: 'section',
    },
    title: {
      type: 'string',
      description: 'Section title rendered above the feature list.',
    },
    description: {
      type: 'string',
      description: 'Optional supporting intro copy for the section heading.',
    },
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          title: {
            type: 'string',
            description: 'Feature heading text.',
          },
          description: {
            type: 'string',
            description: 'Supporting feature description.',
          },
          icon: {
            type: 'string',
            description: 'Optional decorative icon text (emoji or short symbol).',
          },
        },
        additionalProperties: false,
        required: ['description', 'title'],
      },
      description: 'Features to render.',
    },
    layout: {
      enum: ['grid', 'split'],
      description: 'Section layout mode.',
      default: 'grid',
    },
    columns: {
      enum: [2, 3, 4],
      description: 'Grid column count used by the `grid` layout.',
      default: 3,
    },
    mediaPosition: {
      enum: ['start', 'end'],
      description: 'Position of optional media in split layout.',
      default: 'end',
    },
    maxWidth: {
      enum: ['prose', 'narrow', 'wide', 'full'],
      description: 'Max width token forwarded to Container.',
      default: 'wide',
    },
    class: {
      type: 'string',
      description: 'Custom class merged with `.cinder-feature-section`.',
    },
  },
  additionalProperties: false,
  required: ['items', 'title'],
  metadata: {
    unsupportedProps: [
      {
        name: 'children',
        reason: 'function-or-snippet',
        description: 'Optional content rendered under the heading before the features list.',
      },
      {
        name: 'media',
        reason: 'function-or-snippet',
        description: 'Optional media content for split layout.',
      },
    ],
  },
} satisfies ComponentSchema;

export default schema as ComponentSchema;
