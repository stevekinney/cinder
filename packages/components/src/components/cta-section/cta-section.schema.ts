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
      description: 'Main CTA title.',
    },
    description: {
      type: 'string',
      description: 'Optional supporting copy.',
    },
    primaryActionLabel: {
      type: 'string',
      description: 'Label for the primary call-to-action button.',
    },
    secondaryActionLabel: {
      type: 'string',
      description: 'Optional label for a secondary action button.',
    },
    align: {
      enum: ['start', 'center'],
      description: 'Content alignment.',
      default: 'center',
    },
    tone: {
      enum: ['default', 'accent'],
      description: 'Visual tone.',
      default: 'default',
    },
    maxWidth: {
      enum: ['prose', 'narrow', 'wide', 'full'],
      description: 'Max width token forwarded to Container.',
      default: 'wide',
    },
    class: {
      type: 'string',
      description: 'Custom class merged with `.cinder-cta-section`.',
    },
  },
  additionalProperties: false,
  required: ['primaryActionLabel', 'title'],
  metadata: {
    unsupportedProps: [
      {
        name: 'children',
        reason: 'function-or-snippet',
        description: 'Optional supplemental content below action buttons.',
      },
      {
        name: 'onPrimaryClick',
        reason: 'function-or-snippet',
        description: 'Primary action click callback.',
      },
      {
        name: 'onSecondaryClick',
        reason: 'function-or-snippet',
        description: 'Secondary action click callback.',
      },
    ],
  },
} satisfies ComponentSchema;

export default schema as ComponentSchema;
