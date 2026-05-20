import type { ComponentSchema } from '../../schema-types';

const schema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  properties: {
    announcements: {
      type: 'object',
      description: 'Optional overrides for announcement strings.',
    },
    label: {
      type: 'string',
      description: 'Accessible name for the list (applied as aria-label on the list root).',
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
      },
      {
        name: 'formatHandleLabel',
        reason: 'function-or-snippet',
      },
      {
        name: 'getItemLabel',
        reason: 'function-or-snippet',
      },
      {
        name: 'getKey',
        reason: 'function-or-snippet',
      },
      {
        name: 'handle',
        reason: 'function-or-snippet',
      },
      {
        name: 'items',
        reason: 'generic-type-parameter',
      },
      {
        name: 'onreorder',
        reason: 'function-or-snippet',
      },
    ],
  },
} satisfies ComponentSchema;

export default schema as ComponentSchema;
