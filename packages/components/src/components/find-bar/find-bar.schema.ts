import type { ComponentSchema } from '../../schema-types';

const schema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  properties: {
    value: {
      type: 'string',
    },
    activeIndex: {
      type: 'number',
    },
    matchCount: {
      anyOf: [
        {
          type: 'number',
        },
        {
          type: 'null',
        },
      ],
    },
    minQueryLength: {
      type: 'number',
    },
    debounceMs: {
      type: 'number',
    },
    label: {
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
        name: 'onDismiss',
        reason: 'function-or-snippet',
      },
      {
        name: 'onNext',
        reason: 'function-or-snippet',
      },
      {
        name: 'onPrevious',
        reason: 'function-or-snippet',
      },
      {
        name: 'onQueryChange',
        reason: 'function-or-snippet',
      },
    ],
  },
} satisfies ComponentSchema;

export default schema as ComponentSchema;
