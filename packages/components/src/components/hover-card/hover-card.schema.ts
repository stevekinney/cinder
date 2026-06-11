import type { ComponentSchema } from '../../schema-types';

const schema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  properties: {
    open: {
      type: 'boolean',
    },
    openDelay: {
      type: 'number',
    },
    closeDelay: {
      type: 'number',
    },
    placement: {
      enum: [
        'top',
        'top-start',
        'top-end',
        'right',
        'right-start',
        'right-end',
        'bottom',
        'bottom-start',
        'bottom-end',
        'left',
        'left-start',
        'left-end',
      ],
    },
    offset: {
      type: 'number',
    },
    showArrow: {
      type: 'boolean',
    },
    description: {
      type: 'string',
    },
    class: {
      type: 'string',
    },
  },
  additionalProperties: false,
  metadata: {
    unsupportedProps: [
      {
        name: 'children',
        reason: 'function-or-snippet',
        required: true,
      },
      {
        name: 'onopenchange',
        reason: 'function-or-snippet',
      },
      {
        name: 'trigger',
        reason: 'function-or-snippet',
        required: true,
      },
      {
        name: 'triggerRef',
        reason: 'unknown-shape',
      },
    ],
  },
} satisfies ComponentSchema;

export default schema as ComponentSchema;
