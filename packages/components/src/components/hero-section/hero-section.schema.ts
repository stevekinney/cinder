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
    eyebrow: {
      type: 'string',
      description: 'Small uppercase intro label rendered above the title.',
    },
    title: {
      type: 'string',
      description: 'Main marketing headline.',
    },
    description: {
      type: 'string',
      description: 'Supporting copy shown below the title.',
    },
    align: {
      enum: ['start', 'center'],
      description: 'Text alignment for heading and body copy.',
      default: 'start',
    },
    mediaPosition: {
      enum: ['start', 'end'],
      description: 'Position of the optional media panel on wide layouts.',
      default: 'end',
    },
    maxWidth: {
      enum: ['prose', 'narrow', 'wide', 'full'],
      description: 'Max width token forwarded to Container.',
      default: 'wide',
    },
    class: {
      type: 'string',
      description: 'Custom class merged with `.cinder-hero-section`.',
    },
  },
  additionalProperties: false,
  required: ['title'],
  metadata: {
    unsupportedProps: [
      {
        name: 'actions',
        reason: 'function-or-snippet',
        description: 'Optional CTA row, usually one or two Button components.',
      },
      {
        name: 'children',
        reason: 'function-or-snippet',
        description: 'Optional extra content rendered below description/actions.',
      },
      {
        name: 'media',
        reason: 'function-or-snippet',
        description: 'Optional visual/media block (image, demo, illustration).',
      },
    ],
  },
} satisfies ComponentSchema;

export default schema as ComponentSchema;
