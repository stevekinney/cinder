import type { ComponentSchema } from '../../schema-types';

const schema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  properties: {
    enabled: {
      type: 'boolean',
      description:
        'When false the document listener is detached and `onClickAway` is never\ncalled. Defaults to `true`.',
    },
    class: {
      type: 'string',
      description: 'Additional class names merged with the root element.',
    },
  },
  additionalProperties: false,
  metadata: {
    unsupportedProps: [
      {
        name: 'children',
        reason: 'function-or-snippet',
        required: true,
        description: 'Content rendered inside the root element. Required.',
      },
      {
        name: 'onClickAway',
        reason: 'function-or-snippet',
        required: true,
        description:
          'Called with the triggering PointerEvent (or MouseEvent/TouchEvent on\nbrowsers that do not support the Pointer Events API) when the user presses\na pointer device outside the root element.',
      },
    ],
  },
} satisfies ComponentSchema;

export default schema as ComponentSchema;
