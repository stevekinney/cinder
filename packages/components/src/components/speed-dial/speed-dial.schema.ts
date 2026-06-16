import type { ComponentSchema } from '../../schema-types';

const schema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  properties: {
    open: {
      type: 'boolean',
      description: 'Controlled open state.',
      default: false,
    },
    direction: {
      enum: ['up', 'down', 'left', 'right'],
      description: 'Direction the actions fan out.',
      default: 'up',
    },
    hidden: {
      type: 'boolean',
      description: 'Makes the whole control inert and hidden from assistive technology.',
      default: false,
    },
    'aria-label': {
      type: 'string',
      description: 'Accessible label for the root group and trigger button.',
    },
    class: {
      type: 'string',
      description: 'Custom class merged with `.cinder-speed-dial`.',
    },
  },
  additionalProperties: false,
  required: ['aria-label'],
  metadata: {
    unsupportedProps: [
      {
        name: 'children',
        reason: 'function-or-snippet',
        required: true,
        description: '`SpeedDial.Action` children.',
      },
      {
        name: 'trigger',
        reason: 'function-or-snippet',
        required: true,
        description: 'Trigger icon or content rendered inside the FloatingActionButton.',
      },
    ],
  },
} satisfies ComponentSchema;

export default schema as ComponentSchema;
