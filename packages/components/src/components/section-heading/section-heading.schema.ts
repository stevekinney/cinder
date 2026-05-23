import type { ComponentSchema } from '../../schema-types';

const schema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  properties: {
    title: {
      type: 'string',
      description: 'Section title text. Rendered inside the dynamic heading element.',
    },
    description: {
      type: 'string',
      description:
        'Optional supporting description. Supplementary body text, not a heading\n subtitle — rendered after the heading but outside `<hgroup>`.',
    },
    level: {
      enum: [2, 3, 4],
      description:
        "Heading level for the title element. Defaults to `2`. The correct level\n relative to the surrounding document outline is the consumer's responsibility.",
    },
    class: {
      type: 'string',
      description: 'Additional class names merged onto the root `<div>`.',
    },
  },
  additionalProperties: false,
  required: ['title'],
  metadata: {
    unsupportedProps: [
      {
        name: 'actions',
        reason: 'function-or-snippet',
      },
      {
        name: 'label',
        reason: 'function-or-snippet',
      },
      {
        name: 'tabs',
        reason: 'function-or-snippet',
      },
    ],
  },
} satisfies ComponentSchema;

export default schema as ComponentSchema;
