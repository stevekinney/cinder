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
      description: 'Optional heading text for the logo cloud.',
    },
    description: {
      type: 'string',
      description: 'Optional support text under heading.',
    },
    logos: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            description: 'Brand or company name. Used as image alt text.',
          },
          src: {
            type: 'string',
            description: 'Logo image source URL.',
          },
          href: {
            type: 'string',
            description: 'Optional link destination for the logo.',
          },
        },
        additionalProperties: false,
        required: ['name', 'src'],
      },
      description: 'Logos to render in the cloud.',
    },
    columns: {
      enum: [3, 4, 5, 6],
      description: 'Grid columns on wide screens.',
      default: 5,
    },
    grayscale: {
      type: 'boolean',
      description: 'Apply grayscale filter until hover.',
      default: true,
    },
    maxWidth: {
      enum: ['prose', 'narrow', 'wide', 'full'],
      description: 'Max width token forwarded to Container.',
      default: 'wide',
    },
    class: {
      type: 'string',
      description: 'Custom class merged with `.cinder-logo-cloud`.',
    },
  },
  additionalProperties: false,
  required: ['logos'],
} satisfies ComponentSchema;

export default schema as ComponentSchema;
