import type { ComponentSchema } from '../../schema-types';

const schema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  properties: {
    brand: {
      type: 'string',
      description: 'Optional brand/title text rendered in the first column.',
    },
    description: {
      type: 'string',
      description: 'Optional supporting copy rendered under brand.',
    },
    copyright: {
      type: 'string',
      description: 'Copyright text in the legal row.',
    },
    label: {
      type: 'string',
      description: 'Accessible label for the footer landmark.',
    },
    class: {
      type: 'string',
      description: 'Additional classes merged on the root element.',
    },
  },
  additionalProperties: false,
  metadata: {
    unsupportedProps: [
      {
        name: 'groups',
        reason: 'unknown-shape',
        description: 'Link groups rendered as columns in the main area.',
      },
      {
        name: 'legalLinks',
        reason: 'unknown-shape',
        description: 'Additional links rendered in the legal row.',
      },
    ],
  },
} satisfies ComponentSchema;

export default schema as ComponentSchema;
