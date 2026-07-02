import type { ComponentSchema } from '../../schema-types';

const schema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  properties: {
    id: {
      type: 'string',
      description: 'HTML id applied to the dropdown root element. Auto-generated when omitted.',
    },
    class: {
      type: 'string',
      description: "Additional class names merged with the component's root class.",
    },
    open: {
      type: 'boolean',
      description: 'Controls the open state of the dropdown menu; bindable for controlled usage.',
    },
    placement: {
      enum: ['top-start', 'top-end', 'bottom-start', 'bottom-end'],
      description:
        'Preferred menu placement relative to the trigger. Default `bottom-start`.\nThe rendered menu may still flip to stay within the viewport.',
    },
  },
  additionalProperties: false,
  metadata: {
    unsupportedProps: [
      {
        name: 'children',
        reason: 'function-or-snippet',
      },
      {
        name: 'trigger',
        reason: 'function-or-snippet',
      },
    ],
  },
} satisfies ComponentSchema;

export default schema as ComponentSchema;
